/*
See http://tech.bluesmoon.info/2009/11/measuring-users-bandwidth.html for background.

This code is distributed under the BSD license.  Copyright (c) 2010 Philip S Tellis
*/

/**
Include this file at the bottom of your HTML.  You need to configure a few things first.

To configure things for all pages that include this file, change it in the defaults object.
To configure things only for a given page, set each parameter in the PERFORMANCE.BWTest object.

	- PERFORMANCE.BWTest.base_url:		This is the base url for all the bandwidth images.  This parameter is mandatory.

	- PERFORMANCE.BWTest.beacon_url:	This is the URL that will be called (using the GET method) with the bandwidth parameters.
						It will have the following parameters:
						- bw:		The median bandwidth in bytes/second
						- bwa:		The arithmetic mean of bandwidth measurements in bytes/second
						- bwsd:		The standard deviation in all bandwidth samples
						- bwse:		The standard error at 95% confidence for the reported bandwidth value
						- latency:	The median HTTP latency in milliseconds
						- latencya: 	The arithmetic mean of HTTP latency measurements in milliseconds
						- latencysd:	The standard deviation in all latency samples
						- latencyse:	The standard error at 95% confidence for the reported latency value
						You may also use this URL to set a browser cookie with the bandwidth and user's IP.

						If not set, nothing will be beaconed, but you can still get the values out of the window.PERFORMANCE.BWTest object.

	- PERFORMANCE.BWTest.auto_run:		By default, the test will run automatically when this script is included.  Set this to false to turn off auto run.  If you do this, you need to
						call PERFORMANCE.BWTest.run() on your own when you're ready to run the test.

	- PERFORMANCE.BWTest.sample:		Sample percentage.  Set this to a number between 0 and 100 to only test the bandwidth for that percentage of your users.  The default is 100%.

	- PERFORMANCE.BWTest.timeout:		Image timeout in milliseconds - increase this if the majority of your users have slow networks, but 10000 is about as high as you should go

	- PERFORMANCE.BWTest.nruns:		The number of times to run the test -- higher numbers increase accuracy, but requires more time and and a larger byte transfer

	- PERFORMANCE.BWTest.latency_runs:	The number of measures of latency.  This is relatively cheap, so no need to change it

	- PERFORMANCE.BWTest.log_level:		To turn on firebug console logging, set PERFORMANCE.log_level="debug"

These parameters should be set BEFORE including the script on your page.


Methods:
	- PERFORMANCE.BWTest.run():		Call this to start the test manually.  Required if you set PERFORMANCE.BWTest.auto_run to false.
	- PERFORMANCE.BWTest.init():		Call this to reinitialise test runs.  Required if you call run() multiple times.

Events:
	- PERFORMANCE.BWTest.onload:		Callback function that will be called when this file has finished loading.  No parameters are passed to this function.
	- PERFORMANCE.BWTest.oncomplete:	Callback function that will be called when the test has completed.  The result object (as described below) will be passed to this function.
	- PERFORMANCE.BWTest.onloop:		Callback function that will be called before each loop iteration.  This function is called with an object parameter with the following structure:
							{
								type: "bandwidth" OR "latency",
								runs_left: The number of runs left for this type of loop
							}
						If this callback returns false, the loop will be terminated immediately, and the performance report will be generated.

After the test has completed, PERFORMANCE.BWTest.beacon_url will be called with the paramters defined above.  You may also check the bandwidth and latency values from your script using
the following parameters:

	- PERFORMANCE.BWTest.bandwidth_median
	- PERFORMANCE.BWTest.bandwidth_amean
	- PERFORMANCE.BWTest.bandwidth_stddev
	- PERFORMANCE.BWTest.bandwidth_stderr
	- PERFORMANCE.BWTest.latency_median
	- PERFORMANCE.BWTest.latency_amean
	- PERFORMANCE.BWTest.latency_stddev
	- PERFORMANCE.BWTest.latency_stderr
*/
(function() {

var defaults = {
	version: "1.3",
	auto_run: true,
	log_level: 'none',
	sample: 100,

	base_url: '',
	beacon_url: '',

	timeout: 3000,
	nruns: 3,
	latency_runs: 10
};



// ------------------------------------------------------------------------------------
// Do not change anything below this line unless you're adding new features/fixing bugs
// ------------------------------------------------------------------------------------

if(typeof PERFORMANCE === 'undefined')
	window.PERFORMANCE = {};

if(typeof PERFORMANCE.BWTest === 'undefined')
	PERFORMANCE.BWTest = {};

if(typeof PERFORMANCE.BWTest.version !== 'undefined' ) {
	return false;		// don't allow this script to be included twice
}

for(var k in defaults) {
	if(defaults.hasOwnProperty(k) && typeof PERFORMANCE.BWTest[k] === 'undefined')
		PERFORMANCE.BWTest[k] = defaults[k];
}

if(!PERFORMANCE.BWTest.base_url) {
	alert('Set the base_url variable in this script the the directory where your bandwidth images are stored');
	return false;
}

// if this page view does not fall into the random sample, don't bother with the test
if(Math.random()*100 >= PERFORMANCE.BWTest.sample)
	return true;

var base_url = PERFORMANCE.BWTest.base_url;
var beacon_url = PERFORMANCE.BWTest.beacon_url;
var timeout = PERFORMANCE.BWTest.timeout;
var nruns = PERFORMANCE.BWTest.nruns;
var latency_runs = PERFORMANCE.BWTest.latency_runs;


var runs_left=nruns;

// We choose image sizes so that we can narrow down on a bandwidth range as soon as possible
// the sizes chosen correspond to bandwidth values of 14-64kbps, 64-256kbps, 256-1024kbps, 1-2Mbps, 2-8Mbps, 8-30Mbps & 30Mbps+
// Anything below 14kbps will probably timeout before the test completes
// Anything over 60Mbps will probably be unreliable since latency will make up the largest part of download time
// If you want to extend this further to cover 100Mbps & 1Gbps networks, use image sizes of 19,200,000 & 153,600,000 bytes respectively
var images=[
	{ name: "image-0.png", size: 11483, timeout: 1500 }, 
	{ name: "image-1.png", size: 40658, timeout: 1400 }, 
	{ name: "image-2.png", size: 164897, timeout: 1400 }, 
	{ name: "image-3.png", size: 381756, timeout: 1500 }, 
	{ name: "image-4.png", size: 1234664, timeout: 1300 }, 
	{ name: "image-5.png", size: 4509613, timeout: 1300 }, 
	{ name: "image-6.png", size: 9084559, timeout: 1500 }
];

var nimages = images.length;
var smallest_image = 0;

// abuse arrays to do the latency test simply because it avoids a bunch of branches in the rest of the code
images['l'] = { name: "image-l.gif", size: 35, timeout: 1000 };

var results = [];
var latencies = [];

if(typeof console === 'undefined')
	console = { log: function() {} };

var console_log = function() {
	if(PERFORMANCE.BWTest.log_level === 'debug')
		console.log(arguments[0]);
}

PERFORMANCE.BWTest.init = function()
{
	runs_left=nruns;
	latency_runs=10;
	smallest_image=0;
	results = [];
	latencies = [];
};

PERFORMANCE.BWTest.run = function()
{
	defer(start);
}

var start = function()
{
	if(!latency_runs) {
		finish();
	}
	else if(runs_left) {
		results.push({r:[]});
		if(PERFORMANCE.BWTest.onloop)
			if(PERFORMANCE.BWTest.onloop({ type: "bandwidth", runs_left: runs_left }) === false)
				return finish();
		load_img(smallest_image, runs_left--, img_loaded);
	}
	else {
		if(PERFORMANCE.BWTest.onloop)
			if(PERFORMANCE.BWTest.onloop({ type: "latency", runs_left: latency_runs }) === false)
				return finish();
		load_img('l', latency_runs--, lat_loaded);
	}
};

var defer = function(method)
{
	return setTimeout(method, 10);
};

var load_img = function(i, run, callback)
{
	var url = base_url + images[i].name + '?t=' + (new Date().getTime()) + Math.random();
	var timer=0, tstart=0;
	var img = new Image();

	img.onload=function() { img=null; clearTimeout(timer); if(callback) callback(i, tstart, run, true); callback=null; };
	img.onerror=function() { img=null; clearTimeout(timer); if(callback) callback(i, tstart, run, false); callback=null; };

	// the timeout does not abort download of the current image, it just sets an end of loop flag so the next image won't download
	// we still need to wait until onload or onerror fire to be sure that the image download isn't using up bandwidth.
	timer=setTimeout(function() { if(callback) callback(i, tstart, run, null); }, images[i].timeout)));

	tstart = new Date().getTime();
	img.src=url;
};

var lat_loaded = function(i, tstart, run, success)
{
	if(run != latency_runs+1)
		return;

	if(success !== null) {
		var lat = new Date().getTime() - tstart;
		latencies.push(lat);
	}
	PERFORMANCE.BWTest.run();
};

var img_loaded = function(i, tstart, run, success)
{
	if(run != runs_left+1)
		return;

	if(results[nruns-run].r[i])		// already called on this image
		return;

	if(success === null) {			// if timeout, then we set the next image to the end of loop marker
		results[nruns-run].r[i+1] = {t:null, state: null, run: run};
		return;
	}

	var result = { start: tstart, end: new Date().getTime(), t: null, state: success, run: run };
	if(success) {
		result.t = result.end-result.start;
	}
	results[nruns-run].r[i] = result;

	// we terminate if an image timed out because that means the connection is too slow to go to the next image
	if(i >= nimages-1 || typeof results[nruns-run].r[i+1] !== 'undefined') {
		console_log(results[nruns-run]);

		// First run is a pilot test to decide what the largest 2 images that we can download are
		// Remaining runs only try to pull these 2 images
		if(run === nruns && i>1) {
			smallest_image = i-1;
		}
		PERFORMANCE.BWTest.run();
	} else {
		load_img(i+1, run, img_loaded);
	}
};

var ncmp = function(a, b) { return (a-b); };

var calc_latency = function()
{
	var	i, n=latencies.length,
		sum=0, sumsq=0,
		amean, median,
		std_dev, std_err;

	// First we get the arithmetic mean, standard deviation and standard error
	for(i=0; i<latencies.length; i++) {
		sum += latencies[i];
		sumsq += latencies[i] * latencies[i];
	}

	amean = Math.round(sum / n);

	std_dev = Math.sqrt( sumsq/n - sum*sum/(n*n));

	// See http://en.wikipedia.org/wiki/1.96 and http://en.wikipedia.org/wiki/Standard_error_%28statistics%29
	std_err = (1.96 * std_dev/Math.sqrt(n)).toFixed(2);

	std_dev = std_dev.toFixed(2);


	// Next we do IQR filtering and get the median
	var lat_filtered = iqr(latencies.sort(ncmp));
	console_log(lat_filtered);	// sometimes this results in an empty array

	n = lat_filtered.length-1;

	median = Math.round((lat_filtered[Math.floor(n/2)] + latencies[Math.ceil(n/2)])/2);


	return { mean: amean, median: median, stddev: std_dev, stderr: std_err };
};

var calc_bw = function(latency)
{
	var	i, j, n=0,
		r, bandwidths=[], bandwidths_corrected=[],
		sum=0, sumsq=0, sum_corrected=0, sumsq_corrected=0,
		amean, std_dev, std_err, median,
		amean_corrected, std_dev_corrected, std_err_corrected, median_corrected;

	for(i=0; i<nruns; i++) {
		r=results[i].r;

		// the next loop we iterate through backwards and only consider the largest 3 images that succeeded
		// that way we don't consider small images that downloaded fast without really saturating the network
		var nimgs=0;
		for(j=r.length-1; j>=0 && nimgs<3; j--) {
			// discard first value that was calculated since it pays the price for DNS, TCP setup and slowstart
			if(i==0 && j==0)
				continue;
			if(typeof r[j] === 'undefined')	// if we hit an undefined image time, it means we skipped everything before this
				break;
			if(r[j].t === null)
				continue;

			n++;
			nimgs++;

			var bw = img_sizes[j]*1000/r[j].t;
			bandwidths.push(Math.round(bw));
			sum+=b;
			sumsq+=b*b;

			var bw_c = img_sizes[j]*1000/(r[j].t - latency);
			bandwidths_corrected.push(Math.round(bw_c));
			sum_corrected += bw_c;
			sumsq_corrected += bw_c*bw_c;
		}
	}

	console_log('got ' + n + ' readings');

	// first get the mean and corrected mean
	amean = Math.round(sum/n);
	std_dev = Math.sqrt(sumsq/n - Math.pow(sum/n, 2));
	std_err = Math.round(1.96 * std_dev/Math.sqrt(n));
	std_dev = Math.round(std_dev);

	amean_corrected = Math.round(sum_corrected/n);
	std_dev = Math.sqrt(sumsq/n - Math.pow(sum_corrected/n, 2));
	std_err_corrected = Math.round(1.96 * std_dev_corrected/Math.sqrt(n));
	std_dev_corrected = Math.round(std_dev_corrected);

	console_log('bandwidths: ' + bws);
	console_log('corrected: ' + bws_c);

	// then do IQR filtering and get the median

	if(bandwidths.length > 3) {
		bandwidths = iqr(bandwidths.sort(ncmp));
		bandwidths_corrected = iqr(bandwidths_corrected.sort(ncmp));
	} else {
		bandwidths = bandwidths.sort(ncmp);
		bandwidths_corrected = bandwidths_corrected.sort(ncmp);
	}
	n = bandwidths.length-1;
	median = Math.round((bandwidths[Math.floor(n/2)] + bandwidths[Math.ceil(n/2)])/2);

	n = bandwidths_corrected.length-1;
	median_corrected = Math.round((bandwidths_corrected[Math.floor(n/2)] + bandwidths_corrected[Math.ceil(n/2)])/2);

	console_log('after iqr: ' + bws);
	console_log('corrected: ' + bws_c);

	console_log('amean: ' + amean + ', median: ' + median);
	console_log('corrected amean: ' + amean_corrected + ', median: ' + median_corrected);

	return {
		mean: amean,
		stddev: std_dev,
		stderr: std_err,
		median: median,
		mean_corrected: amean_corrected,
		stddev_corrected: std_dev_corrected,
		stderr_corrected: std_err_corrected,
		median_corrected: median_corrected
	};
};

var finish = function()
{
	var l = calc_latency();
	var bw = calc_bw(latency);

	if(beacon_url) {
		var img = new Image();
		img.src = beacon_url + '?bw=' + bw.median_corrected + '&bwa=' + bw.mean_corrected + '&bwsd=' + bw.stddev_corrected + '&bwse=' + bw.stderr_corrected
			+ '&latency=' + l.median + '&latencya=' + l.mean + '&latencysd=' + l.stddev + '&latencyse=' + l.stderr;
	}

	var o = {
		bandwidth_median:	bw.median_corrected,
		bandwidth_amean:	bw.mean_corrected,
		bandwidth_stddev:	bw.stddev_corrected,
		bandwidth_stderr:	bw.stderr_corrected,
		latency_median:		l.median,
		latency_amean:		l.mean,
		latency_stddev:		l.stddev,
		latency_stderr:		l.stderr
	};

	for(var k in o) {
		if(o.hasOwnProperty(k))
			PERFORMANCE.BWTest[k] = o[k];
	}

	if(PERFORMANCE.BWTest.oncomplete)
		PERFORMANCE.BWTest.oncomplete(o);
};

var iqr = function(a)
{
	var l = a.length-1;
	var q1 = (a[Math.floor(l*0.25)] + a[Math.ceil(l*0.25)])/2;
	var q3 = (a[Math.floor(l*0.75)] + a[Math.ceil(l*0.75)])/2;

	var fw = (q3-q1)*1.5;

	var b=[];

	l++;

	for(var i=0; i<l && a[i] < q3+fw; i++) {
		if(a[i] > q1-fw) {
			b.push(a[i]);
		}
	}

	return b;
};

PERFORMANCE.BWTest.init();
if(PERFORMANCE.BWTest.auto_run)
	PERFORMANCE.BWTest.run();

}());

if(PERFORMANCE.BWTest.onload)
	PERFORMANCE.BWTest.onload();
