/******************************
 # maputil.js [SURFmap]
 # Author: Rick Hofstede <r.j.hofstede@utwente.nl>
 # University of Twente, The Netherlands
 # Adapt to OpenLayer by Emmanuel.Reuter@ird.fr
 # Franch Institue for Research and Development
 #
 # LICENSE TERMS: 3-clause BSD license (outlined in license.html)
 *******************************/
        
   /*
    * Creates Polylines according to the specified coordinates and puts 
    * the specified text into the line's information window.
    * Parameters:
    *     coordinate1 - one end point of the line
    *     coordinate2 - one end point of the line
    *     text - the text that has to be put into the line's information window
    *     color - color of the line (used for line color classification)
    *     weight - width of the line (in pixels)
    */
    function create_line (coordinate1, coordinate2, text, color, weight) {
	// Définir le style visuel de la ligne

	var lineStyle = new ol.style.Style({
    		stroke: new ol.style.Stroke({
        	color: color,
        	width: weight,
        	opacity: 0.7
    		})
	});
	// Créer la feature (entité) de la ligne avec la géométrie et le style
	var lineFeature = new ol.Feature({
    		geometry:  new ol.geom.LineString([
			[coordinate1.getCoordinates()[0], coordinate1.getCoordinates()[1]],
     			[coordinate2.getCoordinates()[0], coordinate2.getCoordinates()[1]]
			]),
		description: text,
	});
	lineFeature.setStyle(lineStyle);
		// Ajouter la feature à une couche
	var lineLayer = new ol.layer.Vector({
    		source: new ol.source.Vector({
        	features: [lineFeature]
    		})
	});
	map.addLayer(lineLayer);
	return lineLayer;
    }
    
   /*
    * Creates Markers according to the specified coordinates and the specified text
    * into the marker's information window.
    * Parameters:
    *     coordinates - the coordinates on which the marker should be created
    *     title - tooltip to be shown on rollover
    *     text - the text that has to be put into the marker's information window
    *     color - can be 'green' or 'red' (undefined results in 'red')
    */          
    function create_marker (coordinates, title, text, color) {

        var marker_options = {
                position: coordinates,
                title: title
        };
	var markerOptions;
	var markerindex = markers.length;
	var greenIcon ;
	var blueIcon;

	var defaultStyle = new ol.style.Style({
    		image: new ol.style.Circle({
        	radius: 5,
        	fill: new ol.style.Fill({
            	color: 'red' // Couleur de remplissage rouge
        	}),
        	stroke: new ol.style.Stroke({
            		color: 'red', // Couleur du contour rouge
            		width: 1
        	}),
	
    		}),
		    geometry: function(feature) {
        if (map.getView().getZoom() >= 10 && map.getView().getZoom() <= 15) {
            return feature.getGeometry();
        } else {
            return null; // Ne pas afficher l'élément si la condition de zoom n'est pas remplie
        }
    }
	});

	if (color === 'green') {
    		greenIcon = new ol.style.Style({
			image: new ol.style.Icon({
        			src: 'img/markers/green-dot.png',
			}),
    		});
    		markerOptions = greenIcon ;
	} else if (color === 'blue') {
    		blueIcon = new ol.style.Style({
			image : new ol.style.Icon ({
        			src: 'img/markers/blue-dot.png',
				}),
    		});
    		markerOptions =  blueIcon ;
	} else {
		markerOptions= new ol.style.Style({
                        image: new ol.style.Icon({
                                src: 'img/markers/green-dashed2-dot.png',
                        }),
                });

	}
		
	//console.log('green marker '+color+'  '+JSON.stringify(coordinates)+' title '+title+'  '+text);
	var marker = new ol.layer.Vector({
                source: new ol.source.Vector({
                features: [
                        new ol.Feature({ 
				geometry: new ol.geom.Point([coordinates[0],coordinates[1]]),
				description: text,
				title: title,
				pos : markerindex,
				style : markerOptions,
                        })
                ]
                }),
                style : markerOptions,
        });


        return marker;
    };
    
    /*
     * Generates the HTML (table) code for a line, based on the specified
     * line entries.
     * Parameters:
     *     lines_index - index of line in 'lines' array
     *     line_entries - entry data structure, of which the contents need to
     *         be included in the information window
     */ 
    function generate_line_info_window_contents (lines_index, line_entries) {
        var body = $('<tbody/>');
        var header_line = $('<tr/>', {'class': 'header'});
        header_line.append($('<th/>', {'class': 'src_column left'}).text('Source'));
        header_line.append($('<th/>', {'class': 'dst_column'}).text('Destination'));
        header_line.append($('<th/>').text('Flows'));
        header_line.append($('<th/>').text('Packets'));
        header_line.append($('<th/>').text('Bytes'));
        header_line.append($('<th/>', {'class': 'right'}).text('Throughput'));
        body.append(header_line);
        
        var line_class = 'odd';
        $.each(line_entries, function (entry_index, entry) {
            var body_line = $('<tr/>', {'class': line_class});
            
            // Country names can never be undefined, so no need to check it
            body_line.append($('<td/>', {'class': 'src_column'}).text(format_location_name(entry.src_text.country)));
            body_line.append($('<td/>', {'class': 'dst_column'}).text(format_location_name(entry.dst_text.country)));
            body_line.append($('<td/>').text(apply_SI_Scale(entry.flows)));
            body_line.append($('<td/>').text(apply_SI_Scale(entry.packets)));
            body_line.append($('<td/>').text(apply_SI_Scale(entry.octets)));
            
            var throughput = entry.octets / entry.duration;
            if (throughput == 'Infinity') {
                throughput = 'Not available';
            }
            body_line.append($('<td/>').text(format_throughput(throughput)));
            
            // Add thin line between entries (necessary because entries consist of multiple lines)
            if (entry_index > 0) {
                body_line.find('td').css('border-top', 'thin solid #CCCCCC');
            }
            
            body.append(body_line);
            
            if (!(entry.src_text.region == undefined && entry.dst_text.region == undefined)) {
                line_class = (line_class == 'odd') ? 'even' : 'odd';
                body_line = $('<tr/>', {'class': line_class});
                
                if (entry.src_text.region == undefined) {
                    body_line.append($('<td/>'));
                } else {
                    body_line.append($('<td/>', {'class': 'src_column'}).text(format_location_name(entry.src_text.region)));
                }
            
                if (entry.dst_text.region == undefined) {
                    body_line.append($('<td/>'));
                } else {
                    body_line.append($('<td/>', {'class': 'dst_column'}).text(format_location_name(entry.dst_text.region)));
                }
            
                body_line.append($('<td/><td/><td/><td/>'));
                body.append(body_line);
            }
            
            if (!(entry.src_text.city == undefined && entry.dst_text.city == undefined)) {
                line_class = (line_class == 'odd') ? 'even' : 'odd';
                body_line = $('<tr/>', {'class': line_class});
                
                if (entry.src_text.city == undefined) {
                    body_line.append($('<td/>'));
                } else {
                    body_line.append($('<td/>', {'class': 'src_column'}).text(format_location_name(entry.src_text.city)));
                }
            
                if (entry.dst_text.city == undefined) {
                    body_line.append($('<td/>'));
                } else {
                    body_line.append($('<td/>', {'class': 'dst_column'}).text(format_location_name(entry.dst_text.city)));
                }
            
                body_line.append($('<td/><td/><td/><td/>'));
                body.append(body_line);
            }
            
            if (!(entry.src_text.ip_address == undefined && entry.dst_text.ip_address == undefined)) {
                line_class = (line_class == 'odd') ? 'even' : 'odd';
                body_line = $('<tr/>', {'class': line_class});
                
                if (entry.src_text.ip_address == undefined) {
                    body_line.append($('<td/>'));
                } else {
                    body_line.append($('<td/>', {'class': 'src_column ip_address'}).text(entry.src_text.ip_address));
                }
            
                if (entry.dst_text.ip_address == undefined) {
                    body_line.append($('<td/>'));
                } else {
                    body_line.append($('<td/>', {'class': 'dst_column ip_address'}).text(entry.dst_text.ip_address));
                }
            
                body_line.append($('<td/><td/><td/><td/>'));
                body.append(body_line);
            }
            
            line_class = (line_class == 'odd') ? 'even' : 'odd';
        });
        
        var footer = $('<tr/>', {'class': 'footer'});
        var point1=lines[lines_index].point1.getCoordinates();
	var point2=lines[lines_index].point2.getCoordinates(); 
        var column_count = 6;
        var footer_contents = $('<td/>', { 'colspan': column_count });
        var zoom_in = $('<a/>', { 'href': 'Javascript:zoom(0)' }).text('Zoom In');
        var zoom_out = $('<a/>', { 'href': 'Javascript:zoom(1)' }).text('Zoom Out');
        var quick_zoom_in = $('<a/>', { 'href': 'Javascript:quick_zoom(0)' }).text('Quick Zoom In');
        var quick_zoom_out = $('<a/>', { 'href': 'Javascript:quick_zoom(1)' }).text('Quick Zoom Out');
	// Click handler is attached in create_line when info_window is opened
        var flow_details = $('<a/>', { 'id': 'flow_details lines_index-' + lines_index, 'href': 'Javascript:show_line_flow_details('+lines_index+')' }).text('Flow Details'); 
	var jump_source = $('<a/>', { 'href': 'Javascript:map.getView().setCenter(['+point1+'])' }).text('Jump to source marker');
        var jump_destination = $('<a/>', { 'href': 'Javascript:map.getView().setCenter([' +point2+'])' }).text('Jump to destination marker');
        
        footer_contents.append(zoom_in).append(' - ').append(zoom_out).append(' | ');
        footer_contents.append(quick_zoom_in).append(' - ').append(quick_zoom_out).append(' | ').append(flow_details).append('<br/>');
        footer_contents.append(jump_source).append(' - ').append(jump_destination);
        
        footer.append(footer_contents);
        body.append(footer);
        return body.html();
    }

    /*
     * Generates the HTML (table) code for a marker, based on the specified
     * marker entries.
     * Parameters:
     *     markers_index - index of marker in 'markers' array
     *     marker_entries - entry data structure, of which the contents need to
     *         be included in the information window
     */ 
    function generate_marker_info_window_contents (markers_index, marker_entries) {
        var body = $('<tbody/>');
        var header_line = $('<tr/>', {'class': 'header'});
        
        if (marker_entries[0].hosts == undefined) { // Host
            header_line.append($('<th/>').text('IP address'));
            header_line.append($('<th/>').text('Flows'));
        } else { // Country, region, city
            header_line.append($('<th/>').text('Location'));
            header_line.append($('<th/>').text('Hosts'));
        }
        
        body.append(header_line);
        
        var line_class = 'odd';
        $.each(marker_entries, function (entry_index, entry) {
            var body_line = $('<tr/>', {'class': line_class});
            
            if (marker_entries[0].hosts == undefined) { // Host
                body_line.append($('<td/>').text(entry.text).addClass('ip_address'));
                body_line.append($('<td/>').text(entry.flows));
            } else { // Country, region, city
                body_line.append($('<td/>').text(format_location_name(entry.text)));
                body_line.append($('<td/>').text(entry.hosts.length));
            }
            
            body.append(body_line);
            
            line_class = (line_class == 'odd') ? 'even' : 'odd';
        });
        
        var footer = $('<tr/>', {'class': 'footer'});
        
        var column_count = 2;
        var footer_contents = $('<td/>', { 'colspan': column_count });
        var zoom_in = $('<a/>', { 'href': 'Javascript:zoom(0)' }).text('Zoom In');
        var zoom_out = $('<a/>', { 'href': 'Javascript:zoom(1)' }).text('Zoom Out');
        var quick_zoom_in = $('<a/>', { 'href': 'Javascript:quick_zoom(0)' }).text('Quick Zoom In');
        var quick_zoom_out = $('<a/>', { 'href': 'Javascript:quick_zoom(1)' }).text('Quick Zoom Out');
       
	// Click handler is attached in create_line when info_window is opened
	var flow_details = $('<a/>', { 'id': 'flow_details markers_index-' + markers_index, 'href': 'Javascript:show_marker_flow_details('+markers_index+')' }).text('Flow Details'); 
 
        footer_contents.append(zoom_in).append(' - ').append(zoom_out).append(' | ').append(flow_details).append('<br/>');
        footer_contents.append(quick_zoom_in).append(' - ').append(quick_zoom_out);
        
        footer.append(footer_contents);
        body.append(footer);
        return body.html();
    }

    /*
     * Returns the SURFmap zoom level of the specified Google Maps zoom level.
     * Parameters:
     *      gm_level - the Google Maps zoom level that has to be converted to a SURFmap zoom level
     */
    function get_SM_zoom_level (gm_level) {
        var level = -1;
        
        if (gm_level <= 4) {
            level = 0;  // Country: 2-4
        } else if (gm_level > 4 && gm_level < 8) {
            level = 1;  // Region: 5-7
        } else if (gm_level >= 8 && gm_level < 11) {
            level = 2;  // City: 8-10
        } else if (gm_level >= 11 ) {
            level = 3;  // Host: 11-13
        }
        
        return level;
    }

    /*
     * Returns the Google Maps zoom level of the specified SURFmap zoom level.
     * Parameters:
     *     sm_level - the SURFmap zoom level that has to be converted to a Google Maps zoom level
     */          
    function get_GM_zoom_level (sm_level) {
	//return get_SM_zoom_level(sm_level);
        if (sm_level ==0 ) { // Country
            return 2;
        } else if (sm_level == 1 ) { // Region
            return 5;
        } else if (sm_level ==2) { // City
            return 8;
        } else { // Host
            return 11;
        }
    }
    
    /*
     * Initializes the Google Maps map object and adds listeners to it.
     */
    function init_map () {
          var map_center = ol.proj.fromLonLat([
        parseFloat(session_data['map_center'].substring(session_data['map_center'].indexOf(",") + 1)),
        parseFloat(session_data['map_center'].substring(0, session_data['map_center'].indexOf(",")))
    		]);

    	if (isNaN(map_center[0]) || isNaN(map_center[1])) {
        	show_error(996);
		map_center=[0,0];
    	} 
    	map = new ol.Map({
        	target: 'map_canvas',
        	view: new ol.View({
            		center: map_center,
			projection: 'EPSG:4326',
            		zoom: parseFloat(session_data['zoom_level']),
            		minZoom: 2,
            		maxZoom: 13
        	}),
        	layers: [
            	new ol.layer.Tile({
                	source: new ol.source.OSM()
            		})
        	]
    	});

	// Gérer les événements
    	map.on('singleclick', function (evt) {
        	// Close info_window équivalent à Google Maps
		//info_window.setPosition(evt.coordinate);
		info_window.setPosition(undefined);
	        var coordinate = evt.coordinate; // Coordonnées du clic
    		var pixel = evt.pixel; // Position en pixels du clic sur l'écran
    		var features = map.getFeaturesAtPixel(pixel); // Obtenez les entités (features) à ce pixel

    		var pointFeatures = []; // Tableau pour stocker les features de type ol.geom.Point
    		var lineFeatures = []; // Tableau pour stocker les features de type ol.geom.LineString

		var lineF;
    
    		for (var i = 0; i < features.length; i++) {
        		var feature = features[i];
        		var geometry = feature.getGeometry();
        
        		if (geometry instanceof ol.geom.Point) {
				currentFeature=feature;
            			pointFeatures.push(feature);
				popupElement.innerHTML=feature.get("description");
				info_window.setPosition(coordinate);
        		}
			if (geometry instanceof ol.geom.LineString) {
				lineF=feature;
				lineFeatures.push(feature);
			}
    		}
    
    		if (pointFeatures.length > 0) {
        		// Des éléments de type ol.geom.Point ont été cliqués
        		// Vous pouvez maintenant interagir avec ces éléments (par exemple, afficher des informations)
                        popupElement.innerHTML=currentFeature.get("description");
                        info_window.setPosition(coordinate);
		} else if (lineFeatures.length > 0) {
			 var normalWidth=popupElement.style.width;
                         popupElement.innerHTML=lineF.get("description");
                         //var contentWidth= popupElement.style.width;
                         info_window.setPosition(coordinate);
    		} else {
        		// Aucun élément de type ol.geom.Point n'a été cliqué
    		}
    	});


	map.once('postrender', function() {
    		var extent = map.getView().calculateExtent(map.getSize());

    		var northEast = ol.proj.toLonLat(ol.extent.getTopRight(extent));
    		var southWest = ol.proj.toLonLat(ol.extent.getBottomLeft(extent));

    		if (northEast[1] > 85.0 || southWest[1] < -85.0) {
        		var map_center_wo_gray = hide_gray_map_area();  // Fonction fictive, remplacez par votre logique
        		var map_center_wo_gray_lonlat = ol.proj.toLonLat(map_center_wo_gray);

        		// Déclencher un événement pour indiquer le changement de données de session
        		$(document).trigger('session_data_changed', {
            		'map_center_wo_gray': map_center_wo_gray_lonlat[1] + "," + map_center_wo_gray_lonlat[0]
        		});
    		}
	});

	map.on('moveend', function() {
    		var map_center = map.getView().getCenter();
    		var map_center_lonlat = ol.proj.toLonLat(map_center);

    		// Déclencher un événement pour indiquer le changement de données de session
    		$(document).trigger('session_data_changed', {
        		'map_center': map_center_lonlat[1] + "," + map_center_lonlat[0]
    		});
	});

	map.getView().on('change:resolution', function() {
    		// Récupérer le niveau de zoom actuel

    		var zoomLevel = map.getView().getZoom();

    		 // Déclencher un événement pour indiquer le changement de données de session
    		$(document).trigger('session_data_changed', {
        		'zoom_level': zoomLevel
    		});

    		var old_sm_zoom_level = get_SM_zoom_level(session_data['zoom_level']);
    		var new_sm_zoom_level = get_SM_zoom_level(zoomLevel);

		console.log('change resolution '+old_sm_zoom_level+'  new '+new_sm_zoom_level);

    		if (old_sm_zoom_level !== new_sm_zoom_level) {
			info_window.setPosition(undefined);
        		remove_map_overlays();
			//console.log('old_sm '+old_sm_zoom_level+'  '+new_sm_zoom_level);
        		add_map_overlays(new_sm_zoom_level);
        		init_legend();

        		// Sélectionner le bouton radio appartenant au niveau de zoom actuel
        		$('#zoom_level_' + zoom_levels[new_sm_zoom_level]).prop('checked', true);
    		}

    		map.once('postrender', function() {
        		var map_center = map.getView().getCenter();
        		var map_center_lonlat = ol.proj.toLonLat(map_center);

        		// Vérifier si la zone grise est visible
        		if (map_center_lonlat[1] > 85.0 || map_center_lonlat[1] < -85.0) {
            			var map_center_wo_gray = hide_gray_map_area();  // Fonction fictive, remplacez par votre logique
            			var map_center_wo_gray_lonlat = ol.proj.toLonLat(map_center_wo_gray);

            			// Déclencher un événement pour indiquer le changement de données de session
            			$(document).trigger('session_data_changed', {
                			'map_center_wo_gray': map_center_wo_gray_lonlat[1] + "," + map_center_wo_gray_lonlat[0]
            			});
        		} else if (map_center !== undefined && session_data['map_center_wo_gray'] !== undefined) {
            			var map_center_wo_gray_lonlat = ol.proj.toLonLat(session_data['map_center_wo_gray'].split(','));

            /*
             * Si le centre de la carte a été ajusté en raison d'une zone grise en haut ou en bas de la carte,
             * rétablir le centre de la carte à son centre configuré réel.
             * Lorsqu'appelée en mode de démonstration, lorsque une ligne aléatoire est cliquée par SURFmap, map.getCenter() peut être indéfini.
             */
            			if (map_center[0] === map_center_wo_gray_lonlat[0] && map_center[1] === map_center_wo_gray_lonlat[1]) {
                			map.getView().setCenter(map_center);
            			}
        		}
    		});
	});

	/* Test ajour marker a la main
	*/
 	map.addOverlay(info_window);
	//map.addLayer(markersLayer); // on ajoute la couche des markers

    }
    
    /*
     * Removes all existing map overlays and adds new ones, based on the old and new zoom levels.
     * Parameters:
     *       sm_zoom_level - New/current SURFmap zoom level.
     */  
	function add_map_overlays(sm_zoom_level) {
    		// Lines
    		for (var i = 0; i < lines.length; i++) {
        		if (lines[i].level == sm_zoom_level && !map.getLayers().getArray().includes(lines[i].obj)) {
            			// Ajoute la couche (objet) à la carte si elle n'est pas déjà présente
				if (lines[i] && lines[i].obj !== null && lines[i].obj !== undefined) {
    					map.addLayer(lines[i].obj);
					//line_item.obj.setVisible(true);
				} else {
					window.alert("lineLayer have empty object "+i+"  "+JSON.stringify(lines[i].obj));
				}
        		}
    		}
    		// Markers
    		for (var j = 0; j < markers.length; j++) {
        		if (markers[j].level == sm_zoom_level && !map.getLayers().getArray().includes(markers[j].obj)) {
            			// Ajoute la couche (objet) à la carte si elle n'est pas déjà présente
            			map.addLayer(markers[j].obj); 
				//marker_item.obj.setVisible(true);
        		}
    		}
	}

    
    /*
     * Removes existing map overlays.
     * Parameters:
     *      sm_zoom_level - SURFmap zoom level at which overlays should be removed. If undefined, all overlays are removed.
     */
    function remove_map_overlays(sm_zoom_level) {
    	if (lines !== undefined) {
        	lines.forEach(function (line_item) {
            	if (sm_zoom_level === undefined || sm_zoom_level === line_item.level) {
                	// map.removeLayer(line_item.obj);
			if (line_item.obj !== undefined) {
                		map.removeLayer(line_item.obj);
			}
            	}
        	});
    	}

    	if (markers !== undefined) {
        	markers.forEach(function (marker_item) {
            	if (sm_zoom_level === undefined || sm_zoom_level === marker_item.level) {
                	map.removeLayer(marker_item.obj);
            	}
        	});
    	}
     }

    
    /*
     * Fires a 'click' event on a randomly selected line at the current zoom level.
     */     
   function click_random_line() {
    var zoom_level = get_SM_zoom_level(map.getView().getZoom());
    var lines_at_level = [];

    // Collecter tous les objets de ligne au niveau de zoom actuel
    if (lines !== undefined) {
        lines.forEach(function(line) {
            if (line.level === zoom_level) {
                lines_at_level.push(line);
            }
        });
        // Sélectionner aléatoirement une ligne parmi les lignes collectées
        var selected_line = lines_at_level[Math.floor(Math.random() * lines_at_level.length)];
        var map_center = map.getView().getCenter();
        
        // Mesurer la distance par rapport au centre de la carte
        var distance_point1 = Math.abs(selected_line.point1[0] - map_center[0]) + Math.abs(selected_line.point1[1] - map_center[1]);
        var distance_point2 = Math.abs(selected_line.point2[0] - map_center[0]) + Math.abs(selected_line.point2[1] - map_center[1]);
        
        // Calculer quel extrémité de ligne est la plus proche du centre de la carte
        if (distance_point1 < distance_point2) {
			var clickEvent = new Event('click');
			clickEvent.coordinate = selected_line.point2;
			selected_line.obj.dispatchEvent(clickEvent);
		} else {
			var clickEvent = new Event('click');
			clickEvent.coordinate = selected_line.point1;
			selected_line.obj.dispatchEvent(clickEvent);
		}

    }
} 
   /*
    * This function zooms the SURFmap map to a defined zoom level.
    * Parameters:
    *     direction - can be either 0 (in) or 1 (out)
    *     level - the destination zoom level (optional)
    */          
   	function zoom(direction, level) {
    		var currentZoom = map.getView().getZoom();

    		if (level === undefined) {
        		if (direction === 0) {
            			map.getView().setZoom(currentZoom + 1);
        		} else {
            			map.getView().setZoom(currentZoom - 1);
        		}
    		} else {
        		map.getView().setZoom(level);
    		}
		
	//zoom_level=get_GM_zoom_level(map.getView().getZoom);
	//return zoom_level;
	}
 
    /*
     * This function quick zooms the SURFmap map to the next (SURFmap) zoom level.
     * Parameters:
     *     direction - can be either 0 (in) or 1 (out)
     */ 
    function quick_zoom (direction) {
        var current_level = get_SM_zoom_level(map.getView().getZoom());
	var cur = map.getView().getZoom();
        if (direction == 0) {
            map.getView().setZoom(10);
        } else if (direction == 1) {
            map.getView().setZoom(0);
        }
    }
    
    /*
     * Hides a gray map area by changing the map's center and return the map center after algorithm
     * completion (i.e. map center without visible gray areas).
     */
	function hide_gray_map_area() {
    		var maxLat = ol.proj.toLonLat(map.getView().getProjection().getExtent())[1];
    		var minLat = ol.proj.toLonLat(map.getView().getProjection().getExtent())[3];

    		if (map.getView().calculateExtent(map.getSize())[1] > maxLat) {
        		while (map.getView().calculateExtent(map.getSize())[1] > maxLat) {
            		map.getView().setCenter([map.getView().getCenter()[0] - 0.5, map.getView().getCenter()[1]]);
        		}
    		} else if (map.getView().calculateExtent(map.getSize())[3] < minLat) {
        		while (map.getView().calculateExtent(map.getSize())[3] < minLat) {
            		map.getView().setCenter([map.getView().getCenter()[0] + 0.5, map.getView().getCenter()[1]]);
        		}
    		}
    		return map.getView().getCenter();
	}
     /*
      * for testing only
      */
	function addPoint() {
		var greenIcon = new ol.style.Style({
                        image: new ol.style.Icon({
                                src: 'img/markers/green-dot.png',
                        }),
                });
		var defaultStyle =  new ol.style.Style({
                        image: new ol.style.Icon({
                                src: 'img/markers/blue-dot.png',
                        })
                });


	 
        	var markerL = new ol.layer.Vector({
                source: new ol.source.Vector({
                features: [
                        new ol.Feature({
                                geometry: new ol.geom.Point([ 166.079794, -20.528807]),
                        })
                ]
                }),
                style : greenIcon,
        	});

        //map.addLayer(markerL);


}
