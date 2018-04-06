//Call initialize() when page is loaded
window.addEventListener("load", initialize);

//frequencies and names of guitar strngs in standard tuning
var standard_frequency = new Array(82.4069, 110.000, 146.832, 195.998, 246.942, 329.628);
var strings_name = new Array("E", "A", "D", "G", "B", "E");
var string;	//this variable holds name of string being tuned

//As the name suggests, this function is called when page is loaded
function initialize()
{
	draw();	//draw the circles once and just display "Rhythm" as we don't have any data yet
	var constraints = {audio: true};	//only request audio from microphones, video not required
	//Request permission to record audio. If allowed, call use_stream function, which will process "audio stream".
	//Show error in console if permission is not granted
	navigator.mediaDevices.getUserMedia(constraints)
	.then(function(stream){
		console.log("Connected live audio input :)");	//Yeah, we're happy
		use_stream(stream);
	})
	.catch(function(err) { console.log(err.name + ": " + err.message); }); // always check for errors at the end.
}


//This function take audio stream as input and processes it to recognise guitar string being played and frequency of input audio
function use_stream(stream)
{
	//Create an audio context object
    var audio_context = new (window.AudioContext || window.webkitAudioContext)();
    //Create a new MediaStreamAudioSourceNode object from given stream
    var microphone = audio_context.createMediaStreamSource(stream);
    //Create Analyser node which will used to analyse the signal
    var analyser = audio_context.createAnalyser();
    //Connect MediaStreamAudioSourceNode object microphone with analyser
    microphone.connect(analyser);
    //Twice of number of samples of input audio we want to capture. 4096 seemed sufficient.
    //Higher values will take more CPU time, and may not be doable in real time.
    analyser.fftSize = 4096;
    //Number of sample = 2048
	var bufferLength = analyser.frequencyBinCount;

	//This function will store the data from audio stream into an array, and find its frequency
	//This is THE FUNCTION
	function auto_correlation()
	{
		var difference, min_diff, offset, amplitude, string_offset;
		//Array to take Time Domain Data from analyser and store it
		var buffer = new Float32Array(bufferLength);
		analyser.getFloatTimeDomainData(buffer);
		//First I check amplitude of input, if amplitude is less than certain threshold, tt's just noise. Why to waste time on it!
		amplitude = 0;
		for(var j=0; j<bufferLength; j++)
			amplitude += buffer[j];
		amplitude /= bufferLength;
		if(amplitude > 0.00025)	//arbitrary chosen: It seems that values lower than this are just noise
		{
			//Compare the signal with itself and different offsets(6 offsets for 6 strings).
			//Offset which gives minimum difference will correspond to the string being tuned.
			min_diff = 1000000000;
			for(var i=0; i<6; i++)
			{
				difference = 0;
				// Eg. sample rate is 8 samples/second
				// frequency = 2 
				// 4 samples are taken per wave = offset with which wave will match with itself
				offset = Math.floor((audio_context.sampleRate)/standard_frequency[i]);
				for(var j=0; j<bufferLength-offset; j++)
				{
					difference += Math.abs(buffer[j] - buffer[j + offset]);
				}
				difference /= bufferLength;
				if(difference < min_diff)
				{
					min_diff = difference;
					string = i;	//detected string
				}
			}

			// limits on offsets to which will will correlate waveform
			// limits will be the mid-point of offset of this string and next strings in both directions.
			// Arbitrary values taken for corner strings.
			// We have narrowed down our search for frequency of input signal
			// Input frequency will be between to those corresponding to upper_limit and lower_limit
			var upper_limit, lower_limit;
			if(string == 0)
				upper_limit = 650;
			else upper_limit = Math.floor(((audio_context.sampleRate)/standard_frequency[string-1] + (audio_context.sampleRate)/standard_frequency[string])/2);
			if(string == 5)
				lower_limit = 100;
			else lower_limit = Math.floor(((audio_context.sampleRate)/standard_frequency[string] + (audio_context.sampleRate)/standard_frequency[string+1])/2);

			//Now as we know the string being tuned and frequencies around it
			//compare the input signal with itself with offsets in range [lower_limit, upper_limit]
			// Whichever offset gives minimum difference, corresponds to frequency of input signal
			min_diff = 1000000000;			
			for(var i = lower_limit; i <= upper_limit; i++)
			{
				difference = 0;
				for(var j=0; j<bufferLength-i; j++)
				{
					difference += Math.abs(buffer[j] - buffer[j+i]);
				}
				if(difference < min_diff)
				{
					min_diff = difference;
					//The offset corresponding to frequency of input signal
					offset = i;
				}
			}
			//Frequency of input signal
			frequency = Math.floor((audio_context.sampleRate)/offset);
			// Frequencies for offset <120 or >630 will be just noises, as they are far from range of guitar strings
			// If frequency is well within the range, draw input chart on screen displaying tuning information
			if(offset>120 && offset<630)
			{
				// console.log("string = "+string+"  f = "+frequency+"  offset = "+offset+"\n");
				// console.log("upper_limit = "+upper_limit+"  lower_limit = "+lower_limit+"\n");
				draw(frequency);
			}
		}
		//Recursion: Call itself after every 250ms to be ever-ready to take input and process it
		setTimeout(auto_correlation, 250);
	}
	//Calling auto_correlation once on page load
	auto_correlation();
}


//This function draws that nice animation type doughnut chart on screen
//Global variable "string" tells the string being tuned, argument frequency stands for frequency of input signal
function draw(frequency) {
	//Canvas element
	var doughnut = document.getElementById('doughnut');
	//Set dimensions of chart according to screensize... Therefore different for mobiles and laptops
	var dimension = window.innerHeight*0.7;
	if(window.innerHeight > window.innerWidth)
		dimension = window.innerWidth*0.9;
	doughnut.width = dimension;
	doughnut.height = dimension;
	var dough_ctx = doughnut.getContext("2d");

	// percent tells how close the input signal is from being in tune
	// percent = 100 - error% in input
	var percent;
	if(string == undefined)
		percent = 100;
	else	percent = 100-(Math.abs(frequency.toFixed(1) - standard_frequency[string].toFixed(1))*100)/standard_frequency[string].toFixed(1);

	//Drawing arcs and filling nice colors
	var centreX = dimension*0.5, centreY = dimension*0.5, radius = dimension*0.5;
	var angle = (2*Math.PI*percent)/100.0 - Math.PI/2.0;
	dough_ctx.fillStyle = '#ff9900';
	dough_ctx.beginPath();
	dough_ctx.moveTo(centreX, centreY);	//centre
	dough_ctx.arc(centreX, centreY, radius, -0.5*Math.PI, angle);
	dough_ctx.closePath();
	dough_ctx.fill();
	dough_ctx.fillStyle = '#527a7a';
	dough_ctx.beginPath();
	dough_ctx.moveTo(centreX, centreY);	//centre
	dough_ctx.arc(centreX, centreY, radius*0.7, 0, 2*Math.PI);
	dough_ctx.closePath();
	dough_ctx.fill();


	//Writing information in center of doughnut chart
	dough_ctx.textAlign = "center";

	dough_ctx.fillStyle = "#001a1a";
	dough_ctx.font = 'bold '+(radius*0.4|0) + 'px sans-serif';
	if(string != undefined)
		dough_ctx.fillText(strings_name[string], centreX, centreY-radius*0.05);
	else{
		dough_ctx.font = 'bold '+(radius*0.2|0) + 'px URW Chancery L, cursive';
			dough_ctx.fillText("Rhythm", centreX, centreY);
	}

	dough_ctx.fillStyle = "#001a1a";
	dough_ctx.font = (radius*0.15|0) + 'px sans-serif';
	if(string != undefined)
		dough_ctx.fillText((frequency).toFixed(1)+" Hz", centreX-radius*0.2, centreY+radius*0.2);

	dough_ctx.fillStyle = "#003333";
	dough_ctx.font = (radius*0.15|0) + 'px sans-serif';
	if(string != undefined)
		dough_ctx.fillText("of "+(standard_frequency[string]).toFixed(1)+" Hz", centreX+radius*0.05, centreY+radius*0.40);
}