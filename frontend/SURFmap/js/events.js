/******************************
 # events.js [SURFmap]
 # Author: Rick Hofstede <r.j.hofstede@utwente.nl>
 # University of Twente, The Netherlands
 #
 # LICENSE TERMS: 3-clause BSD license (outlined in license.html)
 *******************************/

$(document).ready(function() {        
    $('#error_dialog').dialog({
        autoOpen:   false,
        zIndex:     4000
    });
    $('#warning_dialog').dialog({
        autoOpen:   false,
        zIndex:     3000
    });
    $('#info_dialog').dialog({
        autoOpen:   false,
        zIndex:     2000
    });
    $('#loading_dialog').dialog({
        autoOpen:   false,
        zIndex:     1000
    });
            
    $(document).bind('loading', function () {
        show_loading_message();
    });
    $(document).trigger('loading');
            
    $(document).bind('config_loaded', function () {
        init_panel();
        
        /* Retrieve list of active extensions
         * --> Comes after config retrieval because 'active_extensions_list_loaded' uses config['log_debug']
         */
        $.ajax({
            url: 'json/getextensions.php',
            success: function(data) {
                if (data.status == 0) { // Success
                    $(document).trigger('active_extensions_list_loaded', data);
                } else {
                    show_error(811, data.status_message);
                }
            }
        });
        
        if (config['log_debug']) {
            log_system_information();
        }
        
        // optimize_display() relies on both 'session_data' and 'config'
        if (session_data != undefined) {
            optimize_display();
        }
    });
    $(document).bind('constants_loaded', function () {
        
    });
            
    $(document).bind('nfsen_config_loaded', function () {
        $(document).trigger('load_session_data');
    });
    
    $(document).bind('active_extensions_list_loaded', function (event, data) {
        extensions = data.extensions;
        
        if (config['log_debug'] && extensions.length > 0) {
            var extension_list = "";
            
            $.each(extensions, function (index, extension) {
                if (extension_list != "") extension_list += ", ";
                extension_list += extension.name;
            });
            
            $.ajax({
                url: 'json/writetosyslog.php',
                data: {
                    params: {
                        'type': "debug",
                        'lines' : [ "Active extensions: " + extension_list ]
                    }
                },
                success: function(data) {
                    if (data.status != 0) { // Failure
                        show_error(816, data.status_message);
                    }
                }
            });
        }
        
        if (flow_data == undefined && session_data != undefined) {
            $(document).trigger('load_flow_data');
        }
    });
    $(document).bind('session_data_loaded', function (event, data) {
        session_data = data;
        
        var cookie_value = get_cookie_value('SURFmap', 'last_used_version_number_retrieved');
        if (cookie_value == undefined || cookie_value == 0) {
            retrieve_last_used_version_number();
        }
        
        if (config['log_debug']) {
            var log_data = [
                "geocoder_history - client (S, B, E, S): "
                        + session_data['geocoder_history']['client']['requests_success'] + ", " 
                        + session_data['geocoder_history']['client']['requests_blocked'] + ", "
                        + session_data['geocoder_history']['client']['requests_error'] + ", "
                        + session_data['geocoder_history']['client']['requests_skipped'],
                "geocoder_history - server (S, B, E, S): "
                        + session_data['geocoder_history']['server']['requests_success'] + ", " 
                        + session_data['geocoder_history']['server']['requests_blocked'] + ", "
                        + session_data['geocoder_history']['server']['requests_error'] + ", "
                        + session_data['geocoder_history']['server']['requests_skipped'],
                "flow_record_count: " + session_data['flow_record_count'],
                "flow_filter: " + session_data['flow_filter'],
                "flow_display_filter: " + session_data['flow_display_filter'],
                "flow_filter: " + session_data['geo_filter'],
                "nfsen_option: " + session_data['nfsen_option'],
                "nfsen_stat_order: " + session_data['nfsen_stat_order'],
                "nfsen_profile: " + session_data['nfsen_profile'],
                "nfsen_profile_type: " + session_data['nfsen_profile_type'],
                "nfsen_all_sources: " + session_data['nfsen_all_sources'].join(", "),
                "nfsen_selected_sources: " + session_data['nfsen_selected_sources'].join(", "),
                "refresh: " + session_data['refresh'],
                "date1: " + session_data['date1'],
                "date2: " + session_data['date2'],
                "hours1: " + session_data['hours1'],
                "hours2: " + session_data['hours2'],
                "minutes1: " + session_data['minutes1'],
                "minutes2: " + session_data['minutes2'],
                "map_center: " + session_data['map_center'],
                "zoom_level: " + session_data['zoom_level'],
                "curl_loaded: " + session_data['curl_loaded'],
                "use_db: " + session_data['use_db']
            ]
            
            $.ajax({
                url: 'json/writetosyslog.php',
                data: {
                    params: {
                        'type': "debug",
                        'lines' : log_data
                    }
                },
                success: function(data) {
                    if (data.status != 0) { // Failure
                        show_error(816, data.status_message);
                    }
                }
            });
        }
        
        init_map();
        configure_panel();
        
        if (flow_data == undefined && extensions != undefined) {
            $(document).trigger('load_flow_data');
        }
        
        // optimize_display() relies on both 'session_data' and 'config'
        if (config != undefined) {
            optimize_display();
        }
    });
            
    $(document).bind('load_session_data', function () {
        show_loading_message('Loading session data');
                
        // Retrieve session data
        $.ajax({
            url: 'json/getsessiondata.php',
            data: { 
                params: { 
                    'nfsen_profile_data_dir': nfsen_config['PROFILEDATADIR'],
                    'nfsen_subdir_layout': nfsen_config['SUBDIRLAYOUT']
                } 
            },
            success: function(data) {
                if (data.status == 0) { // Success
                    $(document).trigger('session_data_loaded', data.session_data);
                } else {
                    show_error(803, data.status_message);
                }
            }
        });
    });
           
    $(document).bind('session_data_changed', function (event, session_params) {
        // Add required parameters
        session_params['nfsen_profile_data_dir'] = nfsen_config['PROFILEDATADIR'];
        session_params['nfsen_subdir_layout'] = nfsen_config['SUBDIRLAYOUT'];
        
        $.ajax({
            url: 'json/setsessiondata.php',
            data: { 
                params: session_params 
            },
            success: function(data) {
                if (data.status == 0) { // Success
                    // Update 'local' session data as well (after server-side verification)
                    $.each(data.session_data, function(key, value) {
                        session_data[key] = value;
                    });
                } else {
                    show_error(807, data.status_message);
                }
            }
        });
    });
            
    $(document).bind('load_flow_data', function () {
        show_loading_message('Loading flow data');
        
        // Flow data
        var selected_nfsen_sources = [];
        $("#nfsensources option:selected").each(function() {
            selected_nfsen_sources.push($(this).val());
        });
        
        $.ajax({
            url: 'json/getflowdata.php',
            data: {
                params: {
                    'date1': session_data['date1'],
                    'date2': session_data['date2'], 
                    'hours1': session_data['hours1'],
                    'hours2': session_data['hours2'], 
                    'minutes1': session_data['minutes1'],
                    'minutes2': session_data['minutes2'],
                    'flow_record_count': session_data['flow_record_count'],
                    'nfsen_filter': session_data['flow_filter'],
                    'nfsen_option': session_data['nfsen_option'],
                    'nfsen_profile': session_data['nfsen_profile'],
                    'nfsen_profile_type': session_data['nfsen_profile_type'],
                    'nfsen_selected_sources': session_data['nfsen_selected_sources'],
                    'nfsen_stat_order': session_data['nfsen_stat_order'],
                    'nfsen_html_dir': nfsen_config['HTMLDIR'],
                    'extensions': extensions
                }
            },
            success: function(data) {
                if (data.status == 0 || (data.status == 1 && data.status_message == "No flow records in result set")) { // Success
                    $(document).trigger('flow_data_loaded', data);
                } else {
                    show_error(804, data.status_message);
                    $(document).trigger('loaded');
                }
            }
        });
    });
            
    $(document).bind('flow_data_loaded', function (event, data) {
        // Flow data can be 'undefined' if an empty flow data set is retrieved
        if (data.flow_data == undefined) {
            flow_data = [];
            $(document).trigger('loaded');
        } else {
            flow_data = data.flow_data;
            $(document).trigger('load_geolocation_data');
        }
    });
            
    $(document).bind('load_geolocation_data', function () {
        show_loading_message('Loading geolocation data');
                
        // Collect all IP addresses
        geolocation_request = [];
        $.each(flow_data, function(key, value) {
            if ($.inArray(value.ipv4_src, geolocation_request) == -1) {
                geolocation_request.push(value.ipv4_src);
            }
            if ($.inArray(value.ipv4_dst, geolocation_request) == -1) {
                geolocation_request.push(value.ipv4_dst);
            }
        });
        
        // Geolocation data
        $.ajax({
            url: 'json/getgeolocationdata.php',
            data: {
                params: geolocation_request
            },
            success: function(data) {
                if (data.status == 0) { // Success
                    $(document).trigger('geolocation_data_loaded', data);
                } else {
                    show_error(805, data.status_message);
                    $(document).trigger('loaded');
                }
            }
        });
    });
            
    $(document).bind('geolocation_data_loaded', function (event, data) {
        geolocation_data = data.geolocation_data;
        
        // Add retrieved geolocation data to flow data
        $.each(flow_data, function(flow_index, flow_item) {
            // Source address
            $.each(geolocation_data, function(geolocation_index, geolocation_item) {
                if (flow_item.ipv4_src == geolocation_item.address) {
                    flow_item.src_country = geolocation_item.country;
                    flow_item.src_region = geolocation_item.region;
                    flow_item.src_city = geolocation_item.city;
                    return false;
                }
            });
                                        
            // Destination address
            $.each(geolocation_data, function(geolocation_index, geolocation_item) {
                if (flow_item.ipv4_dst == geolocation_item.address) {
                    flow_item.dst_country = geolocation_item.country;
                    flow_item.dst_region = geolocation_item.region;
                    flow_item.dst_city = geolocation_item.city;
                    return false;
                }
            });
        });
        
        // Apply geo filter
        show_loading_message('Applying geo filter');
        if (session_data['geo_filter'] == "") {
            $(document).trigger('load_geocoder_data');
        } else {
            /* New 'flow_data' object that contains only geolocation information. Network
             * information has been removed to avoid transmitting superfluous data to server.
             */
            var flow_data_no_network = [];
            $.each(flow_data, function (flow_index, flow_item) {
                var flow_record = {
                    'src_country':  flow_item.src_country,
                    'src_region':  flow_item.src_region,
                    'src_city':  flow_item.src_city,
                    'dst_country':  flow_item.dst_country,
                    'dst_region':  flow_item.dst_region,
                    'dst_city':  flow_item.dst_city
                };
                flow_data_no_network.push(flow_record);
            });
            
            $.ajax({
                url: 'json/applygeofilter.php',
                data: {
                    params: {
                        'geo_filter': session_data['geo_filter'],
                        'flow_record_count': session_data['flow_record_count'],
                        'flow_data': flow_data_no_network
                    }
                },
                success: function(data) {
                    if (data.status == 0) { // Success
                        var removed_records = data.removed_record_indices;
                        
                        $.each(removed_records, function(removal_index, record_index) {
                            // Since records are removed from an array, the positions of all remaining elements are shifted
                            var actual_removal_index = record_index - removal_index;
                            flow_data.splice(actual_removal_index, 1);
                        });
                        
                        $(document).trigger('load_geocoder_data');
                    } else {
                        show_error(814, data.status_message);
                        $(document).trigger('loaded');
                    }
                }
            });
        }
    });
            
    $(document).bind('load_geocoder_data', function () {
        if (session_data['use_db']) {
            show_loading_message('Loading geocoder data');
                
            // Collect all location names
            geocoder_request = [];
            $.each(geolocation_data, function(key, value) {
                if ($.inArray(value.country, geocoder_request) == -1
                        && value.country != "(UNKNOWN)") {
                    geocoder_request.push(value.country);
                }
                if ($.inArray(value.country + ";" + value.region, geocoder_request) == -1
                        && value.country != "(UNKNOWN)"
                        && value.region != "(UNKNOWN)") {
                    geocoder_request.push(value.country + ";" + value.region);
                }
                if ($.inArray(value.country + ";" + value.region + ";" + value.city, geocoder_request) == -1
                        && value.country != "(UNKNOWN)"
                        && value.region != "(UNKNOWN)"
                        && value.city != "(UNKNOWN)") {
                    geocoder_request.push(value.country + ";" + value.region + ";" + value.city);
                }
                if ($.inArray(value.country + ";" + value.city, geocoder_request) == -1
                        && value.country != "(UNKNOWN)"
                        && value.region == "(UNKNOWN)"
                        && value.city != "(UNKNOWN)") {
                    geocoder_request.push(value.country + ";" + value.city);
                }
            });
                    
            // Geocoder data
            $.ajax({
                url: 'json/getgeocoderdata.php',
                data: {
                    params: geocoder_request
                },
                success: function(data) {
                    if (data.status == 0) { // Success
                        // Add retrieved geocoder data to flow data
                        $.each(flow_data, function(flow_index, flow_item) {
                            // Source IP address
                            $.each(data.geocoder_data, function(geocoder_index, geocoder_item) {
                                if (flow_item.src_country == geocoder_item.request) {
                                    flow_item.src_country_lat = geocoder_item.lat;
                                    flow_item.src_country_lng = geocoder_item.lng;
                                }
                                if (flow_item.src_country + ";" + flow_item.src_region == geocoder_item.request) {
                                    flow_item.src_region_lat = geocoder_item.lat;
                                    flow_item.src_region_lng = geocoder_item.lng;
                                }
                                if (flow_item.src_country + ";" + flow_item.src_region + ";" + flow_item.src_city == geocoder_item.request) {
                                    flow_item.src_city_lat = geocoder_item.lat;
                                    flow_item.src_city_lng = geocoder_item.lng;
                                }
                                if (flow_item.src_country + ";" + flow_item.src_city == geocoder_item.request) {
                                    flow_item.src_region_lat = geocoder_item.lat;
                                    flow_item.src_region_lng = geocoder_item.lng;
                                    flow_item.src_city_lat = geocoder_item.lat;
                                    flow_item.src_city_lng = geocoder_item.lng;
                                }
                            });
                                                        
                            // Destination IP address
                            $.each(data.geocoder_data, function(geocoder_index, geocoder_item) {
                                var matched = false;
                                if (flow_item.dst_country == geocoder_item.request) {
                                    flow_item.dst_country_lat = geocoder_item.lat;
                                    flow_item.dst_country_lng = geocoder_item.lng;
                                }
                                if (flow_item.dst_country + ";" + flow_item.dst_region == geocoder_item.request) {
                                    flow_item.dst_region_lat = geocoder_item.lat;
                                    flow_item.dst_region_lng = geocoder_item.lng;
                                }
                                if (flow_item.dst_country + ";" + flow_item.dst_region + ";" + flow_item.dst_city == geocoder_item.request) {
                                    flow_item.dst_city_lat = geocoder_item.lat;
                                    flow_item.dst_city_lng = geocoder_item.lng;
                                }
                                if (flow_item.dst_country + ";" + flow_item.dst_city == geocoder_item.request) {
                                    flow_item.dst_region_lat = geocoder_item.lat;
                                    flow_item.dst_region_lng = geocoder_item.lng;
                                    flow_item.dst_city_lat = geocoder_item.lat;
                                    flow_item.dst_city_lng = geocoder_item.lng;
                                }
                            });
                        });
                        $(document).trigger('geocoder_data_loaded');
                    } else {
                        show_error(806, data.status_message);
                        $(document).trigger('loaded');
                    }
                }
            });
        } else {
            $(document).trigger('start_geocoding');
        }
    });
            
    $(document).bind('geocoder_data_loaded', function () {
        $(document).trigger('start_geocoding');
    });
            
    $(document).bind('start_geocoding', function () {
        show_loading_message('Geocoding');
                
        geocoder_data_server = undefined;
        geocoder_data_client = undefined;
                
        // Collect all place names that have to be geocoded
        geocoder_request = [];
        $.each(flow_data, function() {
            // Coordinates are undefined or '-1' if not found in geolocation database
            // Source
            if ((this.src_country_lat == -1 && this.src_country_lng == -1
                    || this.src_country_lat == undefined && this.src_country_lng == undefined)
                    && this.src_country != "(UNKNOWN)"
                    && $.inArray(this.src_country, geocoder_request) == -1) {
                geocoder_request.push(this.src_country);
            }
            if ((this.src_region_lat == -1 && this.src_region_lng == -1
                    || this.src_region_lat == undefined && this.src_region_lng == undefined)
                    && this.src_country != "(UNKNOWN)"
                    && this.src_region != "(UNKNOWN)"
                    && $.inArray(this.src_country + ";" + this.src_region, geocoder_request) == -1) {
                geocoder_request.push(this.src_country + ";" + this.src_region);
            }
            if ((this.src_city_lat == -1 && this.src_city_lng == -1
                    || this.src_city_lat == undefined && this.src_city_lng == undefined)
                    && this.src_country != "(UNKNOWN)"
                    && this.src_region != "(UNKNOWN)"
                    && this.src_city != "(UNKNOWN)"
                    && $.inArray(this.src_country + ";" + this.src_region + ";" + this.src_city, geocoder_request) == -1) {
                geocoder_request.push(this.src_country + ";" + this.src_region + ";" + this.src_city);
            }
            if ((this.src_city_lat == -1 && this.src_city_lng == -1
                    || this.src_city_lat == undefined && this.src_city_lng == undefined)
                    && this.src_country != "(UNKNOWN)"
                    && this.src_region == "(UNKNOWN)"
                    && this.src_city != "(UNKNOWN)"
                    && $.inArray(this.src_country + ";" + this.src_city, geocoder_request) == -1) {
                geocoder_request.push(this.src_country + ";" + this.src_city);
            }
                    
            // Destination
            if ((this.dst_country_lat == -1 && this.dst_country_lng == -1
                    || this.dst_country_lat == undefined && this.dst_country_lng == undefined)
                    && this.dst_country != "(UNKNOWN)"
                    && $.inArray(this.dst_country, geocoder_request) == -1) {
                geocoder_request.push(this.dst_country);
            }
            if ((this.dst_region_lat == -1 && this.dst_region_lng == -1
                    || this.dst_region_lat == undefined && this.dst_region_lng == undefined)
                    && this.dst_country != "(UNKNOWN)"
                    && this.dst_region != "(UNKNOWN)"
                    && $.inArray(this.dst_country + ";" + this.dst_region, geocoder_request) == -1) {
                geocoder_request.push(this.dst_country + ";" + this.dst_region);
            }
            if ((this.dst_city_lat == -1 && this.dst_city_lng == -1
                    || this.dst_city_lat == undefined && this.dst_city_lng == undefined)
                    && this.dst_country != "(UNKNOWN)"
                    && this.dst_region != "(UNKNOWN)"
                    && this.dst_city != "(UNKNOWN)"
                    && $.inArray(this.dst_country + ";" + this.dst_region + ";" + this.dst_city, geocoder_request) == -1) {
                geocoder_request.push(this.dst_country + ";" + this.dst_region + ";" + this.dst_city);
            }
            if ((this.dst_city_lat == -1 && this.dst_city_lng == -1
                    || this.dst_city_lat == undefined && this.dst_city_lng == undefined)
                    && this.dst_country != "(UNKNOWN)"
                    && this.dst_region == "(UNKNOWN)"
                    && this.dst_city != "(UNKNOWN)"
                    && $.inArray(this.dst_country + ";" + this.dst_city, geocoder_request) == -1) {
                geocoder_request.push(this.dst_country + ";" + this.dst_city);
            }
        });
        
        // If CURL is supported, balance geocoding process between client and server
        var geocoder_request_client = [];
        
        var allowed_requests_client = 2400;
        var allowed_requests_server = 2400;
        if (session_data['use_db']) {
            allowed_requests_client -=
                    - session_data['geocoder_history']['client'].requests_success
                    - session_data['geocoder_history']['client'].requests_blocked
                    - session_data['geocoder_history']['client'].requests_error
                    - session_data['geocoder_history']['client'].requests_skipped;
        }
        
        if (session_data['curl_loaded']) {
            if (session_data['use_db']) {
                allowed_requests_server -=
                        - session_data['geocoder_history']['server'].requests_success
                        - session_data['geocoder_history']['server'].requests_blocked
                        - session_data['geocoder_history']['server'].requests_error
                        - session_data['geocoder_history']['server'].requests_skipped;
            }
            
            if (Math.ceil(geocoder_request.length / 2) > allowed_requests_client) { // More requests than allowed for client
                geocoder_request_client = geocoder_request.slice(0, allowed_requests_client);
            } else {
                geocoder_request_client = geocoder_request.slice(0, Math.ceil(geocoder_request.length / 2));
            }
                    
            var geocoder_request_server;
            if (geocoder_request.length - geocoder_request_client.length > allowed_requests_server) { // More requests than allowed for server
                geocoder_request_server = geocoder_request.slice(geocoder_request_client.length, geocoder_request_client.length + allowed_requests_server);
            } else if (geocoder_request.length == 1 && geocoder_request_client.length == 1) { // Only one place to geocode and it is done already by client
                geocoder_request_server = [];
            } else {
                geocoder_request_server = geocoder_request.slice(geocoder_request.length - geocoder_request_client.length); // select all remaining elements
            }
                    
            // Server
            if (geocoder_request_server.length == 0) {
                var data = new Object();
                data.geocoder_data = [];
                data.requests_success = 0;
                data.requests_blocked = 0;
                data.requests_error = 0;
                data.requests_skipped = 0;
                $(document).trigger('geocoding_server_done', data);
            } else {
                $.ajax({
                    url: 'json/geocode.php',
                    data: {
                        params: geocoder_request_server
                    },
                    success: function(data) {
                        if (data.status == 0) { // Success
                            $(document).trigger('geocoding_server_done', data);
                        } else {
                            show_error(808, data.status_message);
                            $(document).trigger('loaded');
                        }
                    }
                });
            }
        } else {
            if (geocoder_request.length > allowed_requests_client) {
                geocoder_request.slice(0, allowed_requests_client);
            } else {
                geocoder_request_client = geocoder_request;
            }
        }
                    
        // Client
        var inter_geocoder_request_time = 250;
        geocoder_data_client = new Object();
        geocoder_data_client.geocoder_data = [];
        geocoder_data_client.requests_success = 0;
        geocoder_data_client.requests_blocked = 0;
        geocoder_data_client.requests_error = 0;
        geocoder_data_client.requests_skipped = 0;
        
        if (geocoder_request_client.length == 0) {
            $(document).trigger('geocoding_client_done');
        } else {
            $.each(geocoder_request_client, function(index, item) {
                setTimeout(function () {
                    geocoder.geocode({ 'address': item }, function(results, status) {
                        var result = new Object;
                        result['request'] = item;
                        result['status_message'] = status;
                                
                        if (status == google.maps.GeocoderStatus.OK) {
                            geocoder_data_client.requests_success++;
                            result['lat'] = results[0].geometry.location.lat();
                            result['lng'] = results[0].geometry.location.lng();
                        } else if (status == google.maps.GeocoderStatus.OVER_QUERY_LIMIT) {
                            geocoder_data_client.requests_blocked++;
                                
                            // Add current request another time to geocoder_request_client for a retry
                            geocoder_request_client.push(item);
                            inter_geocoder_request_time += 100;
                        } else {
                            geocoder_data_client.requests_error++;
                        }
                            
                        geocoder_data_client.geocoder_data.push(result);
                                
                        if (geocoder_data_client.geocoder_data.length == geocoder_request_client.length) {
                            $(document).trigger('geocoding_client_done');
                        }
                    });
                }, inter_geocoder_request_time * index);
            });
        }
    });
            
    $(document).bind('geocoding_server_done', function (event, data) {
        geocoder_data_server = data;
        if (geocoder_data_client != undefined) {
            $(document).trigger('geocoding_done');
        }
    });
            
    $(document).bind('geocoding_client_done', function (event) {
        if (session_data['curl_loaded'] && geocoder_data_server != undefined) {
            $(document).trigger('geocoding_done');
        }
    });
            
    $(document).bind('geocoding_done', function () {
        // Merge successful client and server geocoder data
        var geocoder_data = [];
        $.each(geocoder_data_client.geocoder_data, function (index, item) {
            if (item.status_message == "OK") {
                geocoder_data.push(item);
            }
        });
        $.each(geocoder_data_server.geocoder_data, function (index, item) {
            if (item.status_message == "OK") {
                geocoder_data.push(item);
            }
        });
                
        // Add retrieved geocoder data to flow data
        $.each(flow_data, function(flow_index, flow_item) {
            // Source IP address
            $.each(geocoder_data, function(geocoder_index, geocoder_item) {
                if (flow_item.src_country == geocoder_item.request) {
                    flow_item.src_country_lat = geocoder_item.lat;
                    flow_item.src_country_lng = geocoder_item.lng;
                }
                if (flow_item.src_country + ";" + flow_item.src_region == geocoder_item.request) {
                    flow_item.src_region_lat = geocoder_item.lat;
                    flow_item.src_region_lng = geocoder_item.lng;
                }
                if (flow_item.src_country + ";" + flow_item.src_region + ";" + flow_item.src_city == geocoder_item.request) {
                    flow_item.src_city_lat = geocoder_item.lat;
                    flow_item.src_city_lng = geocoder_item.lng;
                }
                if (flow_item.src_country + ";" + flow_item.src_city == geocoder_item.request) {
                    flow_item.src_region_lat = geocoder_item.lat;
                    flow_item.src_region_lng = geocoder_item.lng;
                    flow_item.src_city_lat = geocoder_item.lat;
                    flow_item.src_city_lng = geocoder_item.lng;
                }
            });
                                                        
            // Destination IP address
            $.each(geocoder_data, function(geocoder_index, geocoder_item) {
                var matched = false;
                if (flow_item.dst_country == geocoder_item.request) {
                    flow_item.dst_country_lat = geocoder_item.lat;
                    flow_item.dst_country_lng = geocoder_item.lng;
                }
                if (flow_item.dst_country + ";" + flow_item.dst_region == geocoder_item.request) {
                    flow_item.dst_region_lat = geocoder_item.lat;
                    flow_item.dst_region_lng = geocoder_item.lng;
                }
                if (flow_item.dst_country + ";" + flow_item.dst_region + ";" + flow_item.dst_city == geocoder_item.request) {
                    flow_item.dst_city_lat = geocoder_item.lat;
                    flow_item.dst_city_lng = geocoder_item.lng;
                }
                if (flow_item.dst_country + ";" + flow_item.dst_city == geocoder_item.request) {
                    flow_item.dst_region_lat = geocoder_item.lat;
                    flow_item.dst_region_lng = geocoder_item.lng;
                    flow_item.dst_city_lat = geocoder_item.lat;
                    flow_item.dst_city_lng = geocoder_item.lng;
                }
            });
        });
                
        if (session_data['use_db']) {
            show_loading_message('Storing geocoder data');
                
            var geocoder_history = new Object();
            geocoder_history['client'] = new Object();
            geocoder_history['client'].requests_success = geocoder_data_client.requests_success
                    + parseInt(session_data['geocoder_history']['client'].requests_success);
            geocoder_history['client'].requests_blocked = geocoder_data_client.requests_blocked
                    + parseInt(session_data['geocoder_history']['client'].requests_blocked);
            geocoder_history['client'].requests_error = geocoder_data_client.requests_error
                    + parseInt(session_data['geocoder_history']['client'].requests_error);
            geocoder_history['client'].requests_skipped = geocoder_data_client.requests_skipped
                    + parseInt(session_data['geocoder_history']['client'].requests_skipped);
                
            // Only send geocoder history for server-based geocoding if it has been used
            if (geocoder_data_server != undefined) {
                geocoder_history['server'] = new Object();
                geocoder_history['server'].requests_success = geocoder_data_server.requests_success
                        + parseInt(session_data['geocoder_history']['server'].requests_success);
                geocoder_history['server'].requests_blocked = geocoder_data_server.requests_blocked
                        + parseInt(session_data['geocoder_history']['server'].requests_blocked);
                geocoder_history['server'].requests_error = geocoder_data_server.requests_error
                        + parseInt(session_data['geocoder_history']['server'].requests_error);
                geocoder_history['server'].requests_skipped = geocoder_data_server.requests_skipped
                        + parseInt(session_data['geocoder_history']['server'].requests_skipped);
            }
                
            $(document).trigger('session_data_changed', { 'geocoder_history': geocoder_history } );
                    
            if (geocoder_data.length != 0) {
                $.ajax({
                    url: 'json/storegeocoderdata.php',
                    data: {
                        params: geocoder_data
                    },
                    success: function(data) {
                        if (!data.status == 0) { // Error
                            show_error(809, data.status_message);
                            $(document).trigger('loaded');
                        }
                    }
                });
            }
        }
                
        $(document).trigger('process_map_elements');
    });
            
    $(document).bind('process_map_elements', function () {
        show_loading_message('Processing map elements');
        
        complement_location_information();
        remove_map_overlays();
        init_lines();
        init_markers();
        add_map_overlays(get_SM_zoom_level(map.getZoom()));
        init_legend();
        
        $(document).trigger('loaded');
    });
            
    $(document).bind('loaded', function () {
        if ($('input[type=submit]').prop('disabled') != undefined) {
            $('input[type=submit]').removeAttr('disabled');
        }
        if ($('#loading_dialog').dialog('isOpen')) {
            $('#loading_dialog').dialog('close');
            clearInterval(loading_message_timeout_handle);
        }
        
        if (config['demo_mode']) {
            click_random_line();
        }
        
        if (config['show_warnings']) {
            if ($.browser.msie) { // IE is used
                var cookie_value = get_cookie_value('SURFmap', 'msie');
                if (cookie_value == undefined || cookie_value == 0) {
                    show_warning(1);
                    update_cookie_value('SURFmap', 'msie', 1);
                }
            }
            if (flow_data == undefined || flow_data.length == 0) { // No flow records left after filtering
                if (session_data['flow_display_filter'] == "" && session_data['geo_filter']) {
                    show_warning(2);
                } else {
                    show_warning(3);
                }
            }
        }
    });
});
