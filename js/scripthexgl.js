
//test if browser supports webGL

if(Modernizr.webgl) {

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


		//set title of page
		//Need to test that this shows up in GA
		document.title = dvc.maptitle;

		//Fire design functions
		//selectlist(data);
		createInfo(dvc);
		createKey();

		//Set up number formats
		displayformat = d3.format("." + dvc.displaydecimals + "f");
		legendformat = d3.format("." + dvc.legenddecimals + "f");

		//set up basemap
		map = new mapboxgl.Map({
		  container: 'map', // container id
		 // style: style,
		  style: 'https://free.tilehosting.com/styles/positron/style.json?key=ZBXiR1SHvcgszCLwyOFe', //stylesheet location
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
				.domain([0,0.20,0.40,0.60,0.80,1.0])
				.range(colorbrewer.PuBuGn[5]);

		//Loop to generate circle/hexagon for each point in the data

		circles = {"type": "FeatureCollection",
		"name": "circlepolygons",
		"features": []};

		points = {"type": "FeatureCollection",
		"name": "points",
		"features": []};

		data.forEach(function(d,i) {

				var center = [d.lon, d.lat];
				var radius = 0.005;
				var options = {steps: 6, units: 'kilometers', properties: {average_green: d.average_green*100, fill: color(d.average_green), road:d.road}};
				var circle = turf.circle(center, radius, options);
				var point = turf.point(center,options);

				circles.features.push(circle);
        points.features.push(point);
				//var addToMap = [turf.point(center), circle]
				// console.log(addToMap)


		});

		average_road = d3.nest()
										.key(function(d) { return d.road; })
										.rollup(function(values) { return d3.mean(values, function(d) {return +d.average_green; }) })
										.map(data);



		console.log(average_road)


		roadRank = Object.keys(average_road).sort(function(a,b){return average_road[a]-average_road[b]})
		console.log(roadRank);

		numberRoads = roadRank.length;

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
						'fill-extrusion-base': 0,
						'fill-extrusion-opacity': 1
				}, "filter": ["==", "road", ""]
			}, 'place_suburb');


					//Highlight stroke on mouseover (and show area information)

					map.on("click", function(e) {


						//console.log(e.features[0].properties.road);
					  console.log(e.lngLat);
						setFilterRoad(e.lngLat.lat,e.lngLat.lng)
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

						getCodes(myValue);
		});


		//	map.on("mousemove", "OApoints", onMove);


			//Work out zoom level and update
			// map.on("moveend", function (e) {
			// 	zoom = parseInt(map.getZoom());
			//
			// 	baselevel = 13;
			// 	numberperdotlowest = 10;
			// 	dropdensity = 2;
			//
			// 	if(zoom < baselevel) {
			// 		thepowerof = (baselevel - zoom);
			// 		numberperdot = numberperdotlowest * Math.pow(dropdensity,thepowerof);
			//
			// 		d3.select("#people").text("1 dot = ~" +  (numberperdot).toLocaleString('en-GB') + " people")
			// 	} else {
			// 		d3.select("#people").text("1 dot = ~10 people")
			// 	}
			// });

			function getCodes(myPC)	{

				console.log(myPC);

					var myURIstring=encodeURI("https://api.postcodes.io/postcodes/"+myPC);
					$.support.cors = true;
					$.ajax({
						type: "GET",
						crossDomain: true,
						dataType: "jsonp",
						url: myURIstring,
						error: function (xhr, ajaxOptions, thrownError) {
							console.log(thrownError);
								//$("#pcError").text("couldn't process this request").show();

							},
						success: function(data1){
							if(data1.status == 200 ){
								console.log(data1);
								//$("#pcError").hide();
								lat =data1.result.latitude;
								lng = data1.result.longitude;

								success(lat,lng)
								//$("#successMessage").text("The postcode " + myPC + " is situated in " + areaName + " which has an area code of " + area).show();
							} else {
			          //$("#successMessage").hide();
								//$("#pcError").text("Not a valid postcode I'm afraid").show();
							}
						}

					});

				}

		function success(lat,lng) {

			map.flyTo({center:[lng,lat], zoom:16, speed:0.7})

			map.on('flystart', function(){
				flying=true;
			});

			map.on('flyend', function(){
				flying=false;
			});

			setFilterRoad(lat,lng)

		};

		function setFilterRoad(lat,lng) {
			//go on to filter
			var targetPoint = turf.point([lng, lat]);
			var pointsturf = turf.featureCollection(points.features);
			//then check what feature is nearest to the point
			var nearestfeature = turf.nearestPoint(targetPoint, pointsturf);


			map.setFilter("areahover", ["==", "road", nearestfeature.properties.properties.road]);

			roaddata = data.filter(function(d,i) {return d.road == nearestfeature.properties.properties.road})
			console.log(roaddata.length)

			average_road["$" + nearestfeature.properties.properties.road];


			//Work out roadRank
			rank = roadRank.indexOf("$" + nearestfeature.properties.properties.road);

			console.log(roadRank);

			d3.select("#street").html(nearestfeature.properties.properties.road + "<br>" + 	Math.round(average_road["$" + nearestfeature.properties.properties.road]*100) + "% vegetation <br> Ranked " + rank + " out of " + numberRoads + " streets in Cardiff"  )

		}





		function onMove(e) {
				newAREACD = e.features[0].properties.id;

				if(newAREACD != oldAREACD) {
					oldAREACD = e.features[0].properties.id;
					//map.setFilter("OApointshover", ["==", "id", e.features[0].properties.id]);

				//	console.log(e.features[0].properties);

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
			console.log(keydata);

			d3.select('#keydiv').append("p").attr("id","street").text("");

			// legend = d3.select('#keydiv')
			// 	.append('ul')
			// 	.attr('class', 'key')
			// 	.selectAll('g')
			// 	.data(keydata.groups)
			// 	.enter()
			// 	.append('li')
			// 	//.style("background-color", function(d , i) { return dvc.essential.colour_palette[i]; })
			// 	.attr('class', function(d, i) { return 'key-item key-' + i + ' b '+ d.replace(' ', '-').toLowerCase(); })
			// 	.on("mouseover",function(d, i){
			// 		d3.selectAll(".key-item").style("opacity",0.2);
			// 		d3.selectAll(".key-" + i).style("opacity",1);
			// 	})
			// 	.on("mouseout",function(d, i){
			// 		d3.selectAll(".key-item").style("opacity",1);
			// 	})
			//
			// legend.append('label').attr('class','legendlabel').text(function(d,i) {
			// 	var value = parseFloat(d).toFixed(1);
			// 	return d;
			// });
			//
			// legend.append('div').style("width","40px").style("float","right").append("div").attr("class", "legendRect").attr("id",function(d,i){return "legendRect" + i}).style("width","0px");
			//
			// legend.append('b').attr("class", "legendBlocks")
			// 	.style("background-color", function(d , i) { return keydata.colours[i]; });





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
			   .range(colorbrewer.PuBuGn[5]);

			// Set up scales for legend
			x = d3.scaleLinear()
				.domain([breaks[0], breaks[dvc.numberBreaks]]) /*range for data*/
				.range([0,keywidth-30]); /*range for pixels*/


			var xAxis = d3.axisBottom(x)
				.tickSize(5)
				.tickValues(color.domain())
			//	.tickFormat(legendformat);

			var g2 = svgkey.append("g").attr("id","horiz")
				.attr("transform", "translate(15,50)");


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
				.attr("height", function(d,i){return 8*(i+1)})
				.attr("transform", function(d,i){return "translate(0," + -8*(i+1) +")"})
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
				.attr("x", x(10))
				.attr("y", -15)
				.attr("fill","#000")
				.text("");



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


			if(dvc.dropticks) {
				d3.select("#horiz").selectAll("text").attr("transform",function(d,i){
						// if there are more that 4 breaks, so > 5 ticks, then drop every other.
						if(i % 2){return "translate(0,10)"} }
				);
			}
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



		function selectlist(datacsv) {

			var areacodes =  datacsv.map(function(d) { return d.AREACD; });
			var areanames =  datacsv.map(function(d) { return d.AREANM; });
			var menuarea = d3.zip(areanames,areacodes).sort(function(a, b){ return d3.ascending(a[0], b[0]); });

			// Build option menu for occupations
			var optns = d3.select("#selectNav").append("div").attr("id","sel").append("select")
				.attr("id","areaselect")
				.attr("style","width:98%")
				.attr("class","chosen-select");


			optns.append("option")
				.attr("value","first")
				.text("");

			optns.selectAll("p").data(menuarea).enter().append("option")
				.attr("value", function(d){ return d[1]})
				.text(function(d){ return d[0]});

			myId=null;

			$('#areaselect').chosen({width: "98%", allow_single_deselect:true}).on('change',function(evt,params){

					if(typeof params != 'undefined') {

							disableMouseEvents();

							map.setFilter("state-fills-hover", ["==", "AREACD", params.selected]);

							selectArea(params.selected);
							setAxisVal(params.selected);

							zoomToArea(params.selected);

					}
					else {
							enableMouseEvents();
							hideaxisVal();
							onLeave();
							resetZoom();
					}

			});

	};

	}

} else {

	//provide fallback for browsers that don't support webGL
	d3.select('#map').remove();
	d3.select('body').append('p').html("Unfortunately your browser does not support WebGL. <a href='https://www.gov.uk/help/browsers' target='_blank>'>If you're able to please upgrade to a modern browser</a>")

}
