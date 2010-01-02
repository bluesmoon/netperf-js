/*
 See http://tech.bluesmoon.info/2009/11/measuring-users-bandwidth.html for background.
*/

/**
Include this file at the bottom of your HTML.  You need to configure a few things first.

To configure things for all pages that include this file, change it in the defaults object.
To configure things only for a given page, set each parameter in the PERFORMANCE.BWTest object.

	- PERFORMANCE.BWTest.base_url:		This is the base url for all the bandwidth images.  This parameter is mandatory.

	- PERFORMANCE.BWTest.beacon_url:	This is the URL that will be called (using the GET method) with the bandwidth parameters.
						It will have the following parameters:
						- bw:	The median bandwidth in bytes/second
						- latency:	The median HTTP latency in milliseconds
						- bwg:	The geometric mean of bandwidth measurements in bytes/second
						- latencyg: 	The geometric mean of HTTP latency measurements in milliseconds
						You may also use this URL to set a browser cookie with the bandwidth and user's IP.

						If not set, nothing will be beaconed, but you can still get the values out of the window.PERFORMANCE.BWTest object.

	- PERFORMANCE.BWTest.auto_run:		By default, the test will run automatically when this script is included.  Set this to false to turn off auto run.  If you do this, you need to
						call PERFORMANCE.BWTest.run() on your own when you're ready to run the test.

	- PERFORMANCE.BWTest.timeout:		Image timeout in milliseconds - increase this if the majority of your users have slow networks, but 10000 is about as high as you should go

	- PERFORMANCE.BWTest.nruns:		The number of times to run the test -- higher numbers increase accuracy, but requires more time and and a larger byte transfer

	- PERFORMANCE.BWTest.latency_runs:	The number of measures of latency.  This is relatively cheap, so no need to change it

	- PERFORMANCE.BWTest.log_level:		To turn on firebug console logging, set PERFORMANCE.log_level="debug"

These parameters should be set BEFORE including the script on your page.
*/
(function() {

var defaults = {
	version: "1.0",
	auto_run: true,
	log_level = 'none',

	base_url: '',
	beacon_url = '',

	timeout: 3000,
	nruns: 3,
	latency_runs: 10
};



// ---------------------------------------
// Do not change anything below this line
// ---------------------------------------

if(!base_url) {
	alert('Set the base_url variable in this script the the directory where your bandwidth images are stored');
	return false;
}

if(typeof PERFORMANCE === 'undefined')
	window.PERFORMANCE = {};

if(typeof PERFORMANCE.BWTest !== 'undefined' && typeof PERFORMANCE.BWTest.version !== 'undefined' ) {
	return false;		// don't allow this JS to be included twice
}

for(var k in defaults) {
	if(defaults.hasOwnProperty(k) && typeof PERFORMANCE.BWTest[k] === 'undefined')
		PERFORMANCE.BWTest[k] = defaults[k];
}


var runs_left=nruns;

var img_sizes=[10854, 130091, 579015, 1007914, 2148070, 7886174, 11728156];
var nimages = img_sizes.length;

var results = [];
var latencies = [];

if(typeof console === 'undefined')
	console = { log: function() {} };

var console_log = function() {
	if(PERFORMANCE.log_level === 'debug')
		console.log(arguments);
}

var init = function()
{
	runs_left=nruns;
	latency_runs=10;
	results = [];
	latencies = [];
};

PERFORMANCE.run = function()
{
	if(!latency_runs) {
		finish();
	}
	else if(runs_left) {
		results.push({r:[]});
		load_img(0, runs_left--, img_loaded);
	}
	else {
		load_img('l', latency_runs--, lat_loaded);
	}
};

var defer = function(method)
{
	return setTimeout(method, 10);
};

var load_img = function(i, run, callback)
{
	var url = base_url + 'image-' + i + '.png?t=' + (new Date().getTime()) + Math.random();
	var timer=0, tstart=0;
	var img = new Image();

	img.onload=function() { img=null; clearTimeout(timer); if(callback) callback(i, tstart, run, true); callback=null; };
	img.onerror=function() { img=null; clearTimeout(timer); if(callback) callback(i, tstart, run, false); callback=null; };

	timer=setTimeout(function() { img=null; if(callback) callback(i, tstart, run, null); callback=null; }, Math.min(timeout, (typeof i === 'string' ? timeout : img_sizes[i]/5)));

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
	defer(PERFORMANCE.run);
};

var img_loaded = function(i, tstart, run, success)
{
	if(run != runs_left+1)
		return;

	if(results[nruns-run].r[i])		// already called on this image
		return;

	var result = { start: tstart, end: new Date().getTime(), t: null, state: success, run: run };
	if(success) {
		result.t = result.end-result.start;
	}
	results[nruns-run].r[i] = result;

	// we terminate if an image timed out because that means the connection is too slow to go to the next image
	if(success !== null && i < nimages-1) {
		load_img(i+1, run, img_loaded);
	} else {
		console_log(results[nruns-run]);
		defer(PERFORMANCE.run);
	}
};

var ncmp = function(a, b) { return (a-b); };
var finish = function()
{
	var i, j, n=0;

	var latencyg=0;
	for(i=0; i<latencies.length; i++) {
		latencyg += Math.log(latencies[i]);
	}
	latencyg = Math.exp(latencyg/latencies.length);

	latencies = iqr(latencies.sort(ncmp));
	n = latencies.length-1;
	var latency = (latencies[Math.floor(n/2)] + latencies[Math.ceil(n/2)])/2;
	console_log(latencies);

	var bw=0;
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
			bw += Math.log(img_sizes[j]*1000/r[j].t);
			bws.push(Math.round(img_sizes[j]*1000/r[j].t));
		}
	}


	console_log('got ' + n + ' readings');
	var bwg = Math.round(Math.exp(bw/n));

	console_log('bandwidths: ' + bws);

	bws = iqr(bws.sort(ncmp));
	n = bws.length-1;
	var bwm = Math.round((bws[Math.floor(n/2)] + bws[Math.ceil(n/2)])/2);
	var p95 = Math.round(bws[Math.ceil(n*.95)]);

	console_log('after iqr: ' + bws);
	console_log('gmean: ' + bwg + ', median: ' + bwm + ', 95th pc: ' + p95);
	
	if(beacon_url) {
		var img = new Image();
		img.src = beacon_url + '?bw=' + Math.round(bwm) + '&latency=' + Math.round(latency) + '&bwg=' + Math.round(bwg) + '&latencyg=' + Math.round(latencyg);
	}

	var o = {
		bandwidth_median:	bwm,
		latency_median:		latency,
		bandwidth_gmean:	bwg,
		latency_gmean:		latencyg
	};

	for(var k in o) {
		if(o.hasOwnProperty(k))
			PERFORMANCE.BWTest[k] = o[k];
	}
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

init();
defer(PERFORMANCE.run);

}());
