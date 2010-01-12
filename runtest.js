/*
 See http://tech.bluesmoon.info/2009/11/measuring-users-bandwidth.html for details.
*/
(function() {

var dump = function(o) {
	var html = '';
	if(o === null || typeof o === 'boolean')
		html = '(' + (o===null?'null':(o?'true':'false')) + ')';
	else if(typeof o === 'string' || typeof o === 'number')
		html = o;
	else if(typeof o === 'object' && typeof o.length === 'number') {
		html = '[';
		for(var k=0; k<o.length; k++) {
			html += dump(o[k]) + ', ';
		}
		html = html.replace(/, $/, '') + ']';
	}
	else if(typeof o === 'object') {
		html = '{';
		for(var k in o) {
			if(o.hasOwnProperty(k))
				html += k + ': ' + dump(o[k]) + ', ';
		}
		html = html.replace(/, $/, '') + '}<br>';
	}
	return html;
}

if(typeof console === 'undefined') {
	console = { log: null };
	if(location.search.match(/\?debug$/) && document.getElementById('log')) {
		console.log = function() {
			document.getElementById('log').innerHTML += dump(arguments[0]) + '<br>';
		};
	} else {
		console.log = function() {};
	}
}

console.log(navigator.userAgent);

PERFORMANCE = {
	BWTest: {
		base_url: 'http://bluesmoon.info/perf-tests/bw/',
		beacon_url: 'http://bluesmoon.info/perf-tests/bw/beacon.php',
		auto_run: false,
		log_level: 'debug',
		oncomplete: function(o)
		{
			var bw = o.bandwidth_median;
			var bwe = o.bandwidth_stderr;
		
			var bw_text = '';
			var er_text = " (&#x00b1 " + (bwe*100/bw).toPrecision(2) + '%)';
			if(bw*6 < 1024) {
				bw_text = "" + (bw*8) + " ";
			}
			else if(bw*6 < 1024*1024) {
				bw_text = "" + (bw*8/1024).toPrecision(4) + " k";
			}
			else if(bw*6 < 1024*1024*1024) {
				bw_text = "" + (bw*8/1024/1024).toPrecision(4) + " M";
			}
			else {
				bw_text = "" + (bw*8/1024/1024/1024).toPrecision(4) + " G";
			}
		
			document.getElementById('result').innerHTML = "Bandwidth: " + bw_text + "bps " + er_text + ", "
								    + "Latency: " + o.latency_median + "ms (&#x00b1; " + (o.latency_stderr*100/o.latency_median).toPrecision(2) + "%)";

			console.log(o);
		
			document.getElementById('start-test').disabled=false;
		},
		onloop: function(o)
		{
			document.getElementById('result').innerHTML = "Running " + o.type + " test... " + o.runs_left + " run" + (o.runs_left>1?"s":"") + " to go.";
			return true;
		}
	}
};

document.getElementById('start-test').disabled = true;
var s = document.createElement('script');
s.type="text/javascript";
s.src="bw-test.js";
s.onload = function() {
	document.getElementById('start-test').disabled = false;
};
document.getElementsByTagName('head')[0].appendChild(s);

document.getElementById('start-test').onclick=function() {
	PERFORMANCE.BWTest.init();
	this.disabled=true;
	PERFORMANCE.BWTest.run();
	return false;
};

}());
