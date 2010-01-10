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
						- bwg:		The geometric mean of bandwidth measurements in bytes/second
						- bwsd:		The standard deviation in all bandwidth samples
						- bwse:		The standard error at 95% confidence for the reported bandwidth value
						- latency:	The median HTTP latency in milliseconds
						- latencyg: 	The geometric mean of HTTP latency measurements in milliseconds
						- latencysd:	The standard deviation in all latency samples
						- latencyse:	The standard error at 95% confidence for the reported latency value
						You may also use this URL to set a browser cookie with the bandwidth and user's IP.

						If not set, nothing will be beaconed, but you can still get the values out of the window.PERFORMANCE.BWTest object.

	- PERFORMANCE.BWTest.auto_run:		By default, the test will run automatically when this script is included.  Set this to false to turn off auto run.  If you do this, you need to
						call PERFORMANCE.BWTest.run() on your own when you're ready to run the test.

	- PERFORMANCE.BWTest.timeout:		Image timeout in milliseconds - increase this if the majority of your users have slow networks, but 10000 is about as high as you should go

	- PERFORMANCE.BWTest.nruns:		The number of times to run the test -- higher numbers increase accuracy, but requires more time and and a larger byte transfer

	- PERFORMANCE.BWTest.latency_runs:	The number of measures of latency.  This is relatively cheap, so no need to change it

	- PERFORMANCE.BWTest.log_level:		To turn on firebug console logging, set PERFORMANCE.log_level="debug"

These parameters should be set BEFORE including the script on your page.


Methods:
	- PERFORMANCE.BWTest.run():		Call this to start the test manually.  Required if you set PERFORMANCE.BWTest.auto_run to false.
	- PERFORMANCE.BWTest.init():		Call this to reinitialise test runs.  Required if you call run() multiple times.

Events:
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
	- PERFORMANCE.BWTest.bandwidth_gmean
	- PERFORMANCE.BWTest.bandwidth_stddev
	- PERFORMANCE.BWTest.bandwidth_stderr
	- PERFORMANCE.BWTest.latency_median
	- PERFORMANCE.BWTest.latency_gmean
	- PERFORMANCE.BWTest.latency_stddev
	- PERFORMANCE.BWTest.latency_stderr
*/
(function() {

var defaults = {
	version: "1.2",
	auto_run: true,
	log_level: 'none',

	base_url: '',
	beacon_url: '',

	timeout: 3000,
	nruns: 3,
	latency_runs: 10
};



// ---------------------------------------
// Do not change anything below this line
// ---------------------------------------

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

var base_url = PERFORMANCE.BWTest.base_url;
var beacon_url = PERFORMANCE.BWTest.beacon_url;
var timeout = PERFORMANCE.BWTest.timeout;
var nruns = PERFORMANCE.BWTest.nruns;
var latency_runs = PERFORMANCE.BWTest.latency_runs;


var runs_left=nruns;

var img_sizes=[10854, 130091, 579015, 1007914, 2148070, 7886174, 11728156];
var nimages = img_sizes.length;

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
		load_img(0, runs_left--, img_loaded);
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
	var url = base_url + 'image-' + i + '.' + (i==='l'?'gif':'png') + '?t=' + (new Date().getTime()) + Math.random();
	var timer=0, tstart=0;
	var img = new Image();

	img.onload=function() { img=null; clearTimeout(timer); if(callback) callback(i, tstart, run, true); callback=null; };
	img.onerror=function() { img=null; clearTimeout(timer); if(callback) callback(i, tstart, run, false); callback=null; };

	// the timeout does not abort download of the current image, it just sets an end of loop flag so the next image won't download
	// we still need to wait until onload or onerror fire to be sure that the image download isn't using up bandwidth.
	timer=setTimeout(function() { if(callback) callback(i, tstart, run, null); }, Math.min(timeout, (typeof i === 'string' ? timeout : img_sizes[i]/2)));

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
		PERFORMANCE.BWTest.run();
	} else {
		load_img(i+1, run, img_loaded);
	}
};

var ncmp = function(a, b) { return (a-b); };
var finish = function()
{
	var i, j, n=0;

	var latencyg=0;
	var lsum=0;
	var lsumsq=0;
	for(i=0; i<latencies.length; i++) {
		latencyg += Math.log(latencies[i]);

		lsum += latencies[i];
		lsumsq += latencies[i]*latencies[i];
	}
	// geometric mean
	latencyg = Math.round(Math.exp(latencyg/latencies.length));

	var l_sd = Math.sqrt(lsumsq/latencies.length  -  Math.pow(lsum/latencies.length, 2));
	var l_se = Math.round(l_sd/Math.sqrt(latencies.length) * 100)/100;
	l_sd = Math.round(l_sd * 100)/100;

	// iqr filtering and then median
	latencies = iqr(latencies.sort(ncmp));
	console_log(latencies);
	n = latencies.length-1;
	var latency = Math.round((latencies[Math.floor(n/2)] + latencies[Math.ceil(n/2)])/2);

	var bw=0;
	var bsum=0;
	var bsumsq=0;
	n=0;
	var bws=[];
	for(i=0; i<nruns; i++) {
		var r = results[i].r;
		for(j=0; j<r.length; j++) {
			// discard first reading since it pays the price for DNS, TCP setup and slowstart
			if(i==0 && j==0)
				continue;
			if(r[j].t === null)
				continue;

			n++;
			var b = img_sizes[j]*1000/r[j].t;
			bw += Math.log(b);
			bws.push(Math.round(b));

			bsum+=b;
			bsumsq+=b*b;
		}
	}


	console_log('got ' + n + ' readings');
	var bwg = Math.round(Math.exp(bw/n));

	var bw_sd = Math.sqrt(bsumsq/n - Math.pow(bsum/n, 2));
	var bw_se = Math.round(bw_sd/Math.sqrt(n));
	bw_sd = Math.round(bw_sd);

	console_log('bandwidths: ' + bws);

	if(bws.length > 3)
		bws = iqr(bws.sort(ncmp));
	else
		bws = bws.sort(ncmp);
	n = bws.length-1;
	var bwm = Math.round((bws[Math.floor(n/2)] + bws[Math.ceil(n/2)])/2);
	var p95 = Math.round(bws[Math.ceil(n*.95)]);

	console_log('after iqr: ' + bws);
	console_log('gmean: ' + bwg + ', median: ' + bwm + ', 95th pc: ' + p95);
	
	if(beacon_url) {
		var img = new Image();
		img.src = beacon_url + '?bw=' + bwm + '&bwg=' + bwg + '&bwsd=' + bw_sd + '&bwse=' + bw_se
			+ '&latency=' + latency + '&latencyg=' + latencyg + '&latencysd=' + l_sd + '&latencyse=' + l_se;
	}

	var o = {
		bandwidth_median:	bwm,
		bandwidth_gmean:	bwg,
		bandwidth_stddev:	bw_sd,
		bandwidth_stderr:	bw_se,
		latency_median:		latency,
		latency_gmean:		latencyg,
		latency_stddev:		l_sd,
		latency_stderr:		l_se
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
