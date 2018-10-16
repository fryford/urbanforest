
//test if browser supports webGL

if(Modernizr.webgl == false) {

	//setup pymjs
	var pymChild = new pym.Child();

	//Load data and config file
	d3.queue()
		.defer(d3.csv, "cardiff_tree_points_min.csv")
		.defer(d3.json, "data/config.json")
		//.defer(d3.json, "data/geog.json")
		.await(ready);


	function ready (error, data, config){

		//Set up global variables
		dvc = config.ons;
		oldAREACD = "";
		var draw = true;
		city = "Cardiff";



		//set title of page
		//Need to test that this shows up in GA
		document.title = dvc.maptitle;


		//Set up number formats
		displayformat = d3.format("." + dvc.displaydecimals + "f");
		legendformat = d3.format("." + dvc.legenddecimals + "f");

		//set up basemap
		map = new mapboxgl.Map({
		  container: 'map', // container id
		 // style: style,
		 //Qi2gszp5uSG09U66VCvH
		  style: 'https://maps.tilehosting.com/styles/positron/style.json?key=7rA0yA362pBi9PZxyYlY', //stylesheet location
		  center: [-3.1750, 51.488224], // starting position
		  zoom: 13, // starting zoom
		  maxZoom: 20,
			minZoom: 13, //
			pitch: 60,
		  attributionControl: false
		});
		//add fullscreen option
		map.addControl(new mapboxgl.FullscreenControl());

		// Add zoom and rotation controls to the map.
		map.addControl(new mapboxgl.NavigationControl());

		// Disable map rotation using right click + drag
		//map.dragRotate.disable();

		// Disable map rotation using touch rotation gesture
		//map.touchZoomRotate.disableRotation();


		// Add geolocation controls to the map.
		// map.addControl(new mapboxgl.GeolocateControl({
		// 	positionOptions: {
		// 		enableHighAccuracy: true
		// 	}
		// }));

		//add compact attribution
		map.addControl(new mapboxgl.AttributionControl({
			compact: true
		}));

		map.getCanvasContainer().style.cursor = 'pointer';

		//addFullscreen();

		color = d3.scaleThreshold()
				.domain([0.20,0.40,0.60,0.80,1.0])
				.range(colorbrewer.YlGn[5]);

		//Loop to generate circle/hexagon for each point in the data

		circles = {"type": "FeatureCollection",
		"name": "circlepolygons",
		"features": []};

		points = {"type": "FeatureCollection",
		"name": "points",
		"features": []};

		radius = 0.005;

		data.forEach(function(d,i) {

				var center = [+d.lon, +d.lat];
				var options = {steps: 6, units: 'kilometers', properties: {average_green: d.average_green*100, fill: color(d.average_green), road:d.road}};
				var circle = turf.circle(center, radius, options);
				var point = turf.point(center,options);

				circles.features.push(circle);
        points.features.push(point);

		});

		console.log(circles);

		//work out convex hull for bounding area1
		hull = turf.convex(points);


		//work out the average green for each uniquely named road in the city.
		average_road = d3.nest()
										.key(function(d) { return d.road; })
										.rollup(function(values) { return d3.mean(values, function(d) {return +d.average_green; }) })
										.map(data);

		//work out the average green for the whole dataset
		average_city = d3.median(data, function(d) { return +d.average_green; });

		roadRank = Object.keys(average_road).sort(function(a,b){return average_road[b]-average_road[a]})

		numberRoads = roadRank.length;

		//Fire design functions
		//selectlist(data);
		createInfo(dvc);
		createKey();


		map.on('load', function() {

			map.addSource('area', { 'type': 'geojson', 'data': circles });

			console.log("I'm here")

			// map.addLayer({
			// 				'id': 'maine',
			// 				'type': 'fill',
			// 				'source': {
			// 						'type': 'geojson',
			// 						'data': {
			// 								'type': 'Feature',
			// 								'geometry': {
			// 										'type': 'Polygon',
			// 										'coordinates': [hull.geometry.coordinates[0]]
			// 								}
			// 						}
			// 				},
			// 				'layout': {},
			// 				'paint': {
			// 						'fill-color': '#088',
			// 						'fill-opacity': 0.8
			// 				}
			// 		});

			zoomThreshold = 11;

			map.addLayer({
				'id': 'area',
				'type': 'fill-extrusion',
				'source': 'area',
				'layout': {},
				'paint': {
						'fill-extrusion-color': {
							// Get the fill-extrusion-color from the source 'color' property.
						'property': 'fill',
						'type': 'identity'
					},
					'fill-extrusion-height': {
						// Get fill-extrusion-height from the source 'height' property.
						'property': 'average_green',
						'type': 'identity'
					},
					//'fill-extrusion-height': 0,
					  //'fill-extrusion-color': '#000',
					  //'fill-extrusion-height': 100,
						'fill-extrusion-base': 0,
						'fill-extrusion-opacity': 0.6
				}
			}, 'place_suburb');

      console.log("I'm here")

			map.addLayer({
				'id': 'areahover',
				'type': 'fill-extrusion',
				'source': 'area',
				'layout': {},
				'paint': {
							'fill-extrusion-color': {
								// Get the fill-extrusion-color from the source 'color' property.
							'property': 'fill',
							'type': 'identity'
						},
						'fill-extrusion-height': {
							// Get fill-extrusion-height from the source 'height' property.
							'property': 'average_green',
							'type': 'identity'
						},
						//'fill-extrusion-height': 0,
						'fill-extrusion-base': 0,
						'fill-extrusion-opacity': 1
				}, "filter": ["==", "road", ""]
			}, 'place_suburb');

			console.log("I'm here")

					//Highlight stroke on mouseover (and show area information)

					map.on("click", function(e) {


						//console.log(e.features[0].properties.road);
						setFilterRoad(e.lngLat.lat,e.lngLat.lng)
						d3.select("#keydiv").attr("height","auto");
						//console.log(e);
						// map.setFilter("areahover", ["==", "road", e.features[0].properties.road]);
						// d3.select("#street").html(e.features[0].properties.road + "<br>" + Math.round(e.features[0].properties.average_green) + "% vegetation");

						//showAreaInfo(e.features[0].properties.AREANM, rateById[e.features[0].properties.AREACD]);

					});


		 });

		$("#submitPost").click(function( event ) {
						event.preventDefault();
						event.stopPropagation();
						myValue=$("#pcText").val();
						d3.select("#keydiv").style("height","auto");
						getCodes(myValue);
		});


			function getCodes(myPC)	{


					var myURIstring=encodeURI("https://api.postcodes.io/postcodes/"+myPC);
					$.support.cors = true;
					$.ajax({
						type: "GET",
						crossDomain: true,
						dataType: "jsonp",
						url: myURIstring,
						error: function (xhr, ajaxOptions, thrownError) {
								$("#errorMessage").text("Sorry that's not a postcode that we recognise. Try again");

							},
						success: function(data1){
							if(data1.status == 200 ){
								//$("#pcError").hide();
								lat =data1.result.latitude;
								lng = data1.result.longitude;
								success(lat,lng);
							} else {
								$("#errorMessage").text("Sorry thats not a postcode that we recognise. Try again");
							}
						}

					});

				}

		function success(lat,lng) {

			map.flyTo({center:[lng,lat], zoom:15, speed:0.7})

			map.on('flystart', function(){
				flying=true;
			});

			map.on('flyend', function(){
				flying=false;
			});


			var targetPoints = turf.point([lng, lat]);
			var ptsWithin = turf.inside(targetPoints, hull);
			console.log(ptsWithin)
			if(ptsWithin == true) {
					$("#errorMessage").text("");
					setFilterRoad(lat,lng)
			} else {
				  $("#errorMessage").html('Sorry thats not a postcode covered by this research. Here is <a href="http://geoportal.statistics.gov.uk/datasets/major-towns-and-cities-december-2015-boundaries?geometry=-3.587%2C51.424%2C-2.544%2C51.573" target="_blank">the area</a> covered.');
			}


		};

		function setFilterRoad(lat,lng) {
			//go on to filter
			var targetPoint = turf.point([lng, lat]);
			var pointsturf = turf.featureCollection(points.features);
			//then check what feature is nearest to the point
			var nearestfeature = turf.nearestPoint(targetPoint, pointsturf);


			map.setFilter("areahover", ["==", "road", nearestfeature.properties.properties.road]);

			roaddata = data.filter(function(d,i) {return d.road == nearestfeature.properties.properties.road})

			average_road["$" + nearestfeature.properties.properties.road];


			//Work out roadRank
			rank = roadRank.indexOf("$" + nearestfeature.properties.properties.road) + 1;

			//d3.select("#street").html("How green is your street? <br><span>" +nearestfeature.properties.properties.road + "</span>")
			//d3.select("#street").html("How green is " +nearestfeature.properties.properties.road + "?")
			drawArc(average_road["$" + nearestfeature.properties.properties.road]);
			drawIllustration(average_road["$" + nearestfeature.properties.properties.road]*100);
			drawContext(average_road["$" + nearestfeature.properties.properties.road]*100, nearestfeature.properties.properties.road, rank, numberRoads, nearestfeature.geometry.coordinates);


		}

		function drawArc(percentage) {

			var tau = 2 * Math.PI;

			if(draw) {

			draw = false;

			// An arc function with all values bound except the endAngle.
			arc = d3.arc()
			    .innerRadius((keydivwidth/4)-25)
			    .outerRadius((keydivwidth/4)-10)
			    .startAngle(0);

			innerarc = d3.arc()
					.innerRadius((keydivwidth/4)-22)
					.outerRadius((keydivwidth/4)-13)
					.startAngle(0);

			averagearc = d3.arc()
			    .innerRadius((keydivwidth/4)-25)
			    .outerRadius((keydivwidth/4)-6)
			    .startAngle(average_city * tau)
					.endAngle((average_city * tau) +0.05);

			// Get the SVG container, and apply a transform such that the origin is the center of the canvas.
			var svg = d3.select("#keydiv").select(".score"),
			    width = +svg.attr("width"),
			    height = +svg.attr("height");

			g = svg.append("g").attr("transform", "translate(" + width / 2 + "," + ((height / 2) + 10) + ")");

			// Add the background arc, from 0 to 100% (tau).
			var background = g.append("path")
					.datum({endAngle: tau})
			    .style("fill", "#ddd")
			    .attr("d", innerarc);


			// Add the foreground arc
			foreground = g.append("path")
			    .datum({endAngle: 0})
			    .style("fill", "#6cb743")
			    .attr("d", arc);

			// Add the average arc
			var foregroundaverage = g.append("path")
					.attr("class","average_arc")
					.style("fill", "#00722F")
					.attr("opacity",0)
					.attr("d", averagearc)



			// add centre text
			g.append("text")
			  .datum({value: 0})
	      .attr("x", 0)
	      .attr("y", 5)
				.attr("class","percentgreen")
				.attr("text-anchor","middle")
				.attr("fill","#0075A3")
				.attr("font-weight","bold")
	      .text(0);

			g.append("text")
					.attr("x", 0)
					.attr("y", 28)
					.attr("class","textgreen")
					.attr("text-anchor","middle")
					.attr("fill","#0075A3")
					.text("green");

			format = d3.format(",.0%");


		} else {
			d3.select(".average_arc").style("opacity",1)
			d3.select(".context").style("opacity",1)
		}

			foreground.transition()
		      .duration(750)
		      .attrTween("d", arcTween(percentage * tau));




			update(percentage)

		  function update(newValue){


					  g.select("text")
					    .transition()
					      .duration(750)
					      .on("start", function repeat() {
					        d3.active(this)
					            .tween("text", function(d) {
					              var that = d3.select(this),
					                  i = d3.interpolateNumber(d.value, newValue);
					              return function(t) { that.text(format(i(t))); };
					            })
					      }).on("end", function() {
					    	d3.select(this).datum({value: newValue})
					  })
			}

			function arcTween(newAngle) {
			  return function(d) {
			    var interpolate = d3.interpolate(d.endAngle, newAngle);
			    return function(t) {
			      d.endAngle = interpolate(t);
			      return arc(d);
			    };
			  };
			}
		}


		function drawIllustration(percentage) {
			d3.select(".illustration").select("img").remove();
			if(percentage <= 20) {
					d3.select(".illustration").append("img").attr("src","images/urbanforest1.svg");
			} else if (percentage <= 40) {
					d3.select(".illustration").append("img").attr("src","images/urbanforest2.svg");
			} else if (percentage <= 60) {
					d3.select(".illustration").append("img").attr("src","images/urbanforest3.svg");
			} else if (percentage <= 80) {
					d3.select(".illustration").append("img").attr("src","images/urbanforest4.svg");
			} else {
					d3.select(".illustration").append("img").attr("src","images/urbanforest5.svg");
			}

		}

		function drawContext(percentage,road, rank, numberRoads, coords){

				var no = rank
				var lastdigit = no % 10 //#contains last digit


				 if(lastdigit == 1) {
					 stndrdth = "st"
				 } else if(lastdigit == 2) {
					 stndrdth = "nd"
				 } else if(lastdigit == 3) {
					 stndrdth = "rd"
				 } else {
					 stndrdth = "th"
				 }


				d3.select('.context2').html("<span>"+ road + "</span> is the <span>" + rank + "</span><span style='text-transform:none'>" + stndrdth + "</span> greenest street out of <span>" + numberRoads + "</span> in <span>" + city + "</span>");

				d3.select(".streetview").select("a").remove();

				d3.select('.streetview').append("a").attr("href","http://maps.google.com/maps?q=&layer=c&cbll=" + +coords[1] +"," + +coords[0] + "&cbp=11,0,0,0,0").text("Goto Google Streetview").attr("target","_blank");

				//add google street view link

				//http://maps.google.com/maps?q=&layer=c&cbll=31.335198,-89.287204&cbp=11,0,0,0,0

		}

		function onMove(e) {
				newAREACD = e.features[0].properties.id;

				if(newAREACD != oldAREACD) {
					oldAREACD = e.features[0].properties.id;
					//map.setFilter("OApointshover", ["==", "id", e.features[0].properties.id]);

					buildings = displayformat((+e.features[0].properties["average_build"])*100);
					cars = displayformat((+e.features[0].properties["average_car"])*100);
					vegetation = displayformat((+e.features[0].properties["average_green"])*100);

					percentages = [buildings, cars, vegetation];

					d3.selectAll(".percentlabel").remove();

					legend.insert("label",".legendBlocks").attr('class','percentlabel').text(function(d,i) {
						return percentages[i] + "%";
					});

					percentages.forEach(function(d,i) {
						d3.select("#legendRect" + i).transition().duration(300).style("width", (percentages[i]/3.3333333) + "px");
					});


					d3.select("#people").text(e.features[0].properties["road"])




//					selectArea(e.features[0].properties.oa11cd);
//					setAxisVal(e.features[0].properties.oa11cd);
				}
		};


		function onLeave() {
				map.setFilter("state-fills-hover", ["==", "AREACD", ""]);
				oldAREACD = "";
				$("#areaselect").val("").trigger("chosen:updated");
				hideaxisVal();
		};


		function disableMouseEvents() {
				map.off("mousemove", "area", onMove);
				map.off("mouseleave", "area", onLeave);
		}

		function enableMouseEvents() {
				map.on("mousemove", "area", onMove);
				//map.on("click", "area", onClick);
				map.on("mouseleave", "area", onLeave);
		}

		function selectArea(code) {
			$("#areaselect").val(code).trigger("chosen:updated");
		}

		function zoomToArea(code) {

			specificpolygon = areas.features.filter(function(d) {return d.properties.AREACD == code})

			specific = turf.extent(specificpolygon[0].geometry);

			map.fitBounds([[specific[0],specific[1]], [specific[2], specific[3]]], {
  				padding: {top: 150, bottom:150, left: 100, right: 100}
			});

		}

		function resetZoom() {

			map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]]);

		}


		function setAxisVal(code) {
			d3.select("#currLine")
				.style("opacity", function(){if(!isNaN(rateById[code])) {return 1} else{return 0}})
				.transition()
				.duration(400)
				.attr("x1", function(){if(!isNaN(rateById[code])) {return x(rateById[code])} else{return x(midpoint)}})
				.attr("x2", function(){if(!isNaN(rateById[code])) {return x(rateById[code])} else{return x(midpoint)}});


			d3.select("#currVal")
				.text(function(){if(!isNaN(rateById[code]))  {return displayformat(rateById[code])} else {return "Data unavailable"}})
				.style("opacity",1)
				.transition()
				.duration(400)
				.attr("x", function(){if(!isNaN(rateById[code])) {return x(rateById[code])} else{return x(midpoint)}});

		}

		function hideaxisVal() {
			d3.select("#currLine")
				.style("opacity",0)

			d3.select("#currVal").text("")
				.style("opacity",0)
		}

		function createInfo(keydata) {

			//d3.select("#keydiv")
			//console.log(keydata);

			d3.select('#keydiv').append("p").attr("id","errorMessage").text("");
			//d3.select('#keydiv').append("p").attr("id","street").text("")

			keydivwidth = parseInt(d3.select("#keydiv").style("width"));

			d3.select('#keydiv').append("div").attr("class","context").style("width",keydivwidth +"px").html("&#8212; <span style='font-weight:400'>"+ city +" average </span>" + Math.round(average_city*100) + "%" ).style("opacity",0);
			d3.select('#keydiv').append("svg").attr("class","score").attr("width",keydivwidth/2).attr("height",keydivwidth/2);
			d3.select('#keydiv').append("div").attr("class","illustration").style("width",keydivwidth/2 +"px").style("height",keydivwidth/2 +"px").style("float","right");
;
			d3.select('#keydiv').append("div").attr("class","context2").style("width",(keydivwidth-20) +"px").html("<span>Your road</span> is the <span>xx</span><span style='text-transform:none'>th</span> greenest street out of <span>xxx</span> in <span>" + city + "</span>");
			d3.select('#keydiv').append("div").attr("class","streetview").style("width",keydivwidth +"px");

			drawArc(0);
			drawIllustration(0);


		}

		function createKey(){

			keywidth = d3.select("#legenddiv").node().getBoundingClientRect().width;

			var svgkey = d3.select("#legenddiv")
				.append("svg")
				.attr("id", "key")
				.attr("width", keywidth)
				.attr("height",75);

			breaks = [0,20,40,60,80,100];

			var color = d3.scaleThreshold()
			   .domain([0,20,40,60,80,100])
			   .range(colorbrewer.YlGn[5]);

			// Set up scales for legend
			x = d3.scaleLinear()
				.domain([breaks[0], breaks[dvc.numberBreaks]]) /*range for data*/
				.range([0,keywidth-30]); /*range for pixels*/


			var xAxis = d3.axisBottom(x)
				.tickSize(5)
				.tickValues(color.domain())
			//	.tickFormat(legendformat);

			var g2 = svgkey.append("g").attr("id","horiz")
				.attr("transform", "translate(15,35)");


			keyhor = d3.select("#horiz");

			g2.selectAll("rect")
				.data(color.range().map(function(d,i) {

				  return {
					x0: i ? x(color.domain()[i+1]) : x.range()[0],
					x1: i < color.domain().length ? x(color.domain()[i+1]) : x.range()[1],
					z: d
				  };
				}))
			  .enter().append("rect")
				.attr("class", "blocks")
				.attr("height", function(d,i){return 5*(i+1)})
				.attr("transform", function(d,i){return "translate(0," + -5*(i+1) +")"})
				.attr("x", function(d) {
					 return d.x0; })
				.attr("width", function(d) {return d.x1 - d.x0; })
				.style("opacity",0.8)
				.style("fill", function(d) { return d.z; });


			g2.append("line")
				.attr("id", "currLine")
				.attr("x1", x(10))
				.attr("x2", x(10))
				.attr("y1", -10)
				.attr("y2", 8)
				.attr("stroke-width","2px")
				.attr("stroke","#000")
				.attr("opacity",0);

			g2.append("text")
				.attr("id", "currVal")
				.attr("x", 19)
				.attr("y", 32)
				.attr("fill","#000")
				.text("% green");



			keyhor.selectAll("rect")
				.data(color.range().map(function(d, i) {
				  return {
					x0: i ? x(color.domain()[i]) : x.range()[0],
					x1: i < color.domain().length ? x(color.domain()[i+1]) : x.range()[1],
					z: d
				  };
				}))
				.attr("x", function(d) { return d.x0; })
				.attr("width", function(d) { return d.x1 - d.x0; })
				.style("fill", function(d) { return d.z; });

			keyhor.call(xAxis).append("text")
				.attr("id", "caption")
				.attr("x", -63)
				.attr("y", -20)
				.text("");

			keyhor.append("rect")
				.attr("id","keybar")
				.attr("width",8)
				.attr("height",0)
				.attr("transform","translate(15,0)")
				.style("fill", "#ccc")
				.attr("x",x(0));


			//Temporary	hardcode unit text
			//dvc.unittext = "change in life expectancy";

			//d3.select("#keydiv").append("p").attr("id","keyunit").style("margin-top","-10px").style("margin-left","10px").text(dvc.varunit);

	} // Ends create key

	function addFullscreen() {

		currentBody = d3.select("#map").style("height");
		d3.select(".mapboxgl-ctrl-fullscreen").on("click", setbodyheight)

	}

	function setbodyheight() {
		d3.select("#map").style("height","100%");

		document.addEventListener('webkitfullscreenchange', exitHandler, false);
		document.addEventListener('mozfullscreenchange', exitHandler, false);
		document.addEventListener('fullscreenchange', exitHandler, false);
		document.addEventListener('MSFullscreenChange', exitHandler, false);

	}


	function exitHandler() {

		console.log("shrink");
			if (document.webkitIsFullScreen === false)
			{
				shrinkbody();
			}
			else if (document.mozFullScreen === false)
			{
				shrinkbody();
			}
			else if (document.msFullscreenElement === false)
			{
				shrinkbody();
			}
		}

	function shrinkbody() {
		d3.select("#map").style("height",currentBody);
		pymChild.sendHeight();
	}

	function geolocate() {

		var options = {
		  enableHighAccuracy: true,
		  timeout: 5000,
		  maximumAge: 0
		};

		navigator.geolocation.getCurrentPosition(success, error, options);
	}

	}

} else {

	//provide fallback for browsers that don't support webGL
	d3.select('#map').remove();
	d3.select('body').append('p').html("Unfortunately your browser does not support WebGL. <a href='https://www.gov.uk/help/browsers' target='_blank>'>If you're able to please upgrade to a modern browser</a>")

}
