
//test if browser supports webGL

if(Modernizr.webgl) {

	//setup pymjs
	var pymChild = new pym.Child();

	//Load data and config file
	d3.queue()
		.defer(d3.csv, "cardiff_data.csv")
		.defer(d3.json, "data/config.json")
		.await(ready);


	function ready (error, data, config){


		//Set up global variables
		dvc = config.ons;
		oldAREACD = "";
		var draw = true;
		city = "Cardiff";

		commaFormat = d3.format(',')




		//set title of page
		//Need to test that this shows up in GA
		document.title = dvc.maptitle;

		//show information
		d3.select("#infofootertext")
			.on("click", function(){
				d3.select("#howtouseinfo").style("display","block")
				dataLayer.push({'event':'buttonClicked','selected':'instructions'})

			});

		d3.select("#OK")
			.on("click", function(){d3.select("#howtouseinfo").style("display","none")});


		//Set up number formats
		displayformat = d3.format("." + dvc.displaydecimals + "f");
		legendformat = d3.format("s");

		//set up basemap
		map = new mapboxgl.Map({
		  container: 'map', // container id
		  style: 'data/stylenew.json',
		  center: [-3.1750, 51.488224], // starting position
		  zoom: 14, // starting zoom
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


		var bboxPolygonCardiff = turf.bboxPolygon([-3.27843, 51.45315, -3.08093, 51.54714]);
		var bboxPolygonNewport = turf.bboxPolygon([-3.083526, 51.550568, -2.879582, 51.621126]);

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

		numberRoads = commaFormat(roadRank.length);

		//Fire design functions
		//selectlist(data);
		createInfo(dvc);
		createKey();


		map.on('load', function() {

			map.addSource('area', { 'type': 'geojson', 'data': circles });

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



					//Highlight stroke on mouseover (and show area information)

					map.on("click", function(e) {

						setFilterRoad(e.lngLat.lat,e.lngLat.lng)
						d3.select("#keydiv").attr("height","auto");

						dataLayer.push({
						            'event':'mapClickSelect',
						            'selected': "roadselected"
						})
					});

		 });

	   map.on('data', function(e) {
				 if (e.dataType === 'source' && e.sourceId === 'area') {
						 document.getElementById("loader").style.visibility = "hidden";
				 }
		 })


		map.on('moveend', inCity)

		function inCity() {
			viewportmap = map.getBounds();

			pointstotest = [];

			/*NE*/ pointstotest.push([viewportmap._ne.lng, viewportmap._ne.lat])
			/*SW*/ pointstotest.push([viewportmap._sw.lng, viewportmap._sw.lat])
			/*SE*/ pointstotest.push([viewportmap._sw.lng, viewportmap._ne.lat])
			/*NW*/ pointstotest.push([viewportmap._ne.lng, viewportmap._sw.lat])

			var allpoints = turf.points(pointstotest)

			var ptsWithinCardiff = turf.pointsWithinPolygon(allpoints, bboxPolygonCardiff);
			var ptsWithinNewport = turf.pointsWithinPolygon(allpoints, bboxPolygonNewport);

			if(ptsWithinCardiff.features.length > 0) {
				newcity = "Cardiff"
			} else if(ptsWithinNewport.features.length > 0) {
				newcity = "Newport"
			}

			if(newcity != city) {
				city=newcity;
				if(city == "Newport" || city == "Cardiff") {
					loadbydrag = true;
					loadnewdata(newcity);
				}
			}





		}

		$("#submitPost").click(function( event ) {
						event.preventDefault();
						event.stopPropagation();
						myValue=$("#pcText").val();
						d3.select("#keydiv").style("height","auto");
						getCodes(myValue);

						dataLayer.push(
							{'event':'buttonClicked',
							'selected':'postcodeSearch'}
						);
						//Work out whether it's a Newport or Cardiff postcode





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
								$("#errorMessage").text("Sorry, that's not a postcode we recognise. Please try again.");

							},
						success: function(data1){
							if(data1.status == 200 ){
								//$("#pcError").hide();
								lat =data1.result.latitude;
								lng = data1.result.longitude;
								newcity = data1.result.admin_district;
							  if(newcity != city) {
									city = newcity;
									if(city == "Newport" || city == "Cardiff") {
										flytonewcity(newcity,lat,lng);
									} else {
										success(lat,lng);
									}
								} else {
									success(lat,lng);
								}

							} else {
								$("#errorMessage").text("Sorry, that's not a postcode we recognise. Please try again.");
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
			if(ptsWithin == true) {
					$("#errorMessage").text("");
					setFilterRoad(lat,lng)
			} else {
				  $("#errorMessage").html('Sorry, that postcode is not covered by this research. It currently covers <a href="http://geoportal.statistics.gov.uk/datasets/major-towns-and-cities-december-2015-boundaries?geometry=-3.587%2C51.424%2C-2.544%2C51.573" target="_blank">major towns and city boundaries</a> for Cardiff & Newport.');
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
			drawArc(average_road["$" + nearestfeature.properties.properties.road], average_city);
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
			foregroundaverage = g.append("path")
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


			update(percentage,average_city)

		  function update(newValue,city_average){

				averagearc = d3.arc()
				    .innerRadius((keydivwidth/4)-25)
				    .outerRadius((keydivwidth/4)-6)
				    .startAngle(city_average * tau)
						.endAngle((city_average * tau) +0.05);

				d3.select(".average_arc")
					.attr("d", averagearc);


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

				var no = rank;

				 // if(lastdigit == "1") {
					//  stndrdth = "st"
				 // } else if(lastdigit == "2") {
					//  stndrdth = "nd"
				 // } else if(lastdigit == "3") {
					//  stndrdth = "rd"
				 // } else if(lastdigit == "21") {
					//  stndrdth = "th"
				 // } else if(lastdigit == "") {
					//  stndrdth = "th"
				 // } else {
					//  stndrdth = "th"
				 // }


			   var j = no % 10,
			       k = no % 100;
			   if (j == 1 && k != 11) {
			       stndrdth = "st";
			   } else if (j == 2 && k != 12) {
			       stndrdth = "nd";
			   } else if (j == 3 && k != 13) {
			       stndrdth = "rd";
			   } else {
					 	 stndrdth = "th";
				 }



				d3.select('.context2').html("<span>"+ road + "</span> is the <span>" + commaFormat(rank) + "</span><span style='text-transform:none'>" + stndrdth + "</span> greenest street out of <span>" + numberRoads + "</span> in <span>" + city + "</span>");

				d3.select("#twitterShare").attr("href","https://twitter.com/intent/tweet?text=I just found out my road is " + displayformat(percentage) + "%25 green! How green is yours? If you live in Newport and Cardiff, you can check here " + ParentURL)

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

				}
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


		function createInfo(keydata) {

			d3.select('#keydiv').append("p").attr("id","errorMessage").text("");
			//d3.select('#keydiv').append("p").attr("id","street").text("")

			keydivwidth = parseInt(d3.select("#keydiv").style("width"));
			bodywidth = parseInt(d3.select("body").style("width"));

			if(bodywidth < 790 && bodywidth > 590) {
				keydivwidth=(keydivwidth/2);
			}

			d3.select('#keydiv').append("div").attr("class","context").style("width",keydivwidth +"px").html("&#8212; <span style='font-weight:400'>"+ city +" average </span>" + Math.round(average_city*100) + "%" ).style("opacity",0);
			d3.select('#keydiv').append("svg").attr("class","score").attr("width",keydivwidth/2).attr("height",keydivwidth/2);
			d3.select('#keydiv').append("div").attr("class","illustration").style("width",keydivwidth/2 +"px").style("height",keydivwidth/2 +"px").style("float","right");


		if(bodywidth < 790 && bodywidth > 590) {
			d3.select('#keydiv').append("div").attr("class","context2").style("width",(keydivwidth*(70/50))-20 +"px").html("Enter your postcode or click on the map to find out how green your street is.");
			d3.select('#keydiv').append("div").attr("class","share").style("width",(keydivwidth*(30/50))-30 +"px").html("<span>Share</span>");
		} else {
			d3.select('#keydiv').append("div").attr("class","context2").style("width",(keydivwidth-20) +"px").html("Enter your postcode or click on the map to find out how green your street is.");
			d3.select('#keydiv').append("div").attr("class","share").style("width",(keydivwidth-20) +"px").html("<span>Share</span>");
		}

			sharebuttons = 	d3.select('.share').append("div").style("padding-top","5px")

			clickedlink = false;

			ParentURL = (window.location != window.parent.location)
										? document.referrer
										: document.location;

			sharebuttons.append("a")
				.attr("id","facebookShare")
				.attr("href","https://www.facebook.com/sharer/sharer.php?u=" + ParentURL)
				.attr("target","_blank")
				.attr("title","Facebook")
			  .append("img")
				.attr("class","socialicon")
				.attr("src","images/facebook.svg")
				.style("height","30px")
				.style("width","30px");

			sharebuttons.append("a")
					.attr("id","twitterShare")
					.attr("href","https://twitter.com/intent/tweet?text=How green is your street? Explore vegetation at street level in Cardiff and Newport with this interactive map " + ParentURL)
					.attr("target","_blank")
					.style("height","30px")
					.style("width","30px")
					.attr("title","Twitter")
					.append("img")
					.attr("class","socialicon")
					.attr("src","images/twitter.svg")
					.style("height","30px")
					.style("width","30px")
					.style("padding-left","5px")
					.style("padding-right","5px");

			sharebuttons.append("img")
					.attr("class","socialicon")
					.attr("src","images/link.svg")
					.style("height","30px")
					.style("width","30px")
					.on("click", copiedtoclipboard);

			d3.selectAll(".socialicon").on("click", function(){
				dataLayer.push({'event':'buttonClicked','selected':'socialshare'})
			})

			sharebuttons.append("p").attr("class","copytextlabel").text("Copy this link").style("text-align","left").style("font-weight","400").style("font-size","14px").style("margin","5px").style("display","none");
			sharebuttons.append("input").attr("class","copytext").attr("value",ParentURL).style("height","30px").style("width","100%").style("display","none");



			drawArc(0);
			drawIllustration(0);


		}

		function copiedtoclipboard () {

			if(clickedlink ==false) {
				clickedlink =true;
				d3.select(".copytextlabel").style("display","block");
				d3.select(".copytext").style("display","block");
			}	else {
				clickedlink =false;
				d3.select(".copytextlabel").style("display","none");
				d3.select(".copytext").style("display","none");
			}
		}

		function createKey(){

			keywidth = d3.select("#legenddiv").node().getBoundingClientRect().width;

			var svgkey = d3.select("#legenddiv")
				.append("svg")
				.attr("id", "key")
				.attr("width", keywidth)
				.attr("height",65);

			breaks = [0,20,40,60,80,100];

			var color = d3.scaleThreshold()
			   .domain([0,20,40,60,80,100])
			   .range(colorbrewer.YlGn[5]);

			// Set up scales for legend
			x = d3.scaleLinear()
				.domain([breaks[0], breaks[dvc.numberBreaks]]) /*range for data*/
				.range([0,keywidth-40]); /*range for pixels*/


			var xAxis = d3.axisBottom(x)
				.tickSize(5)
				.tickValues(x.domain())
			  .tickFormat(function(d) { return d + "%"; })

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
				.attr("x", 90)
				.attr("y", 18)
				.attr("fill","#000")
				.html("more vegetation &rarr;");



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

			keyhor.call(xAxis)
				.append("text")
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


	function flytonewcity(city, lat,lng) {

	  map.off('moveend', inCity)

		map.flyTo({center:[lng,lat], zoom:15, speed:0.7})
		loadnewdata(city);
		loadbydrag = false;
	}

	function loadnewdata(city) {

		map.removeLayer('area')
		map.removeLayer('areahover')
		map.removeSource('area')

		d3.queue()
			.defer(d3.csv, city.toLowerCase() + "_data.csv")
			.await(loaddata);

	}

	function loaddata(error, data){

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

		numberRoads = commaFormat(roadRank.length);


		map.addSource('area', { 'type': 'geojson', 'data': circles });

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

		if(loadbydrag == false) {
			success(lat,lng);
		}

		d3.select(".context").html("&#8212; <span style='font-weight:400'>"+ city +" average </span>" + Math.round(average_city*100) + "%" );

		map.on('moveend', inCity)


	}

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
