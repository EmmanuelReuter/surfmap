<?php
    /*******************************
     # retrievelocation.php [SURFmap]
     # Author: Rick Hofstede
     # University of Twente, The Netherlands
     #
     # LICENSE TERMS: 3-clause BSD license (outlined in license.html)
     *******************************/
    
    require_once("../config.php");
    require_once("../util.php");
    require_once("../lib/MaxMind/geoipcity.inc");
    require_once("../lib/IP2Location/ip2location.class.php");
    
    // Retrieve External IP address and location
    $ext_IP = (!getenv("SERVER_ADDR")) ? "127.0.0.1" : getenv("SERVER_ADDR");
    if ($ext_IP == "127.0.0.1") {
        $ext_IP_NAT = true;
    } else {
        $ext_IP_NAT = false;
        
        foreach ($config['internal_domains'] as $key => $value) {
            $internal_domain_nets = explode(";", $key);
           //error_log(' key '.$config['internal_domains']); 
            foreach($internal_domain_nets as $subnet) {
		//error_log('subnet '.$subnet);
                if (ip_address_in_net($ext_IP, $subnet)) {
                    $ext_IP_NAT = true;
                    //break;
                }
            }
            unset($subnet);
        }
        unset($key, $value);
    }
//	error_log('curl extension loaded '.extension_loaded('curl'));
    if (extension_loaded('curl')) {
        // Used if cURL detects some IPv6-related connectivity problems
        $IPv6_problem = 0;
    
        /*
         * If the found (external) IP address of the server is the localhost
         * address or a NATed address, try do find it using external resources.
         */
        if ($ext_IP_NAT) {
            $NAT_IP = $ext_IP;
            try {
                if (extension_loaded('curl')) {
                    for ($i = 0; $i < 4; $i++) {
                        $ch = curl_init();
                        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
                        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
               //error_log('config use proxy '.$config['use_proxy']); 
                        if ($config['use_proxy']) {
                            curl_setopt($ch, CURLOPT_PROXYTYPE, $config['proxy_type']);
                            curl_setopt($ch, CURLOPT_PROXY, $config['proxy_ip']);
                            curl_setopt($ch, CURLOPT_PROXYPORT, $config['proxy_port']);
                
                            if ($config['proxy_user_authentication']) {
                                curl_setopt($ch, CURLOPT_PROXYUSERPWD, $config['proxy_username'].":".$config['proxy_password']);
                            }
                        }
                    
                        if ($IPv6_problem) {
                            curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
                        }
                    
                        if ($i % 2 == 0) {
                            curl_setopt($ch, CURLOPT_URL, "http://surfmap.sourceforge.net/get_ext_ip.php");
				curl_setopt($ch, CURLOPT_FOLLOWLOCATION, TRUE);
				//error_log('curl surfmap sourcefoge ');
                        } else {
                            curl_setopt($ch, CURLOPT_URL, "http://mijnip.antagonist.nl"); 
				curl_setopt($ch, CURLOPT_FOLLOWLOCATION, TRUE);
				//error_log('curl mijnip');
                        }
                        $ext_IP = curl_exec($ch);
                   	//error_log(' curl fetch '.$ext_IP); 
                        if ($ext_IP === false && curl_error($ch) == "name lookup timed out") {
                            $IPv6_problem = 1;
                        } else if (substr_count($ext_IP, ".") == 3) {
                            if ($ext_IP == $NAT_IP) {
                                $ext_IP_NAT = false;
                            }
                            break;
                        }
                    
                        curl_close($ch);
                    }
                }

                /*
                 * If 'substr_count($extIP, ".") != 3' it means that it was not an IP address that was downloaded,
                 * which can be the case when an error has occurred.
                 */
                if (substr_count($ext_IP, ".") != 3) {
                    $ext_IP = $NAT_IP;
                    $ext_IP_error = "Unable to retrieve external IP address";
                }
            } catch (Exception $e) {}
        }
    } else {
        $result['status'] = 1;
        $result['status_message'] = "PHP cURL module is not installed";
        echo json_encode($result);
        die();
    }
    
    if ($config['geolocation_db'] == "IP2Location") {
        $GEO_database = new ip2location();
        $GEO_database->open("../".$config['ip2location_path']);
        $data = $GEO_database->getAll($ext_IP);
        
        $ext_IP_country = $data->countryLong;
        if ($ext_IP_country == "-") $ext_IP_country = "(UNKNOWN)";
        
        $ext_IP_region = $data->region;
        if ($ext_IP_region == "-") $ext_IP_region = "(UNKNOWN)";
        
        $ext_IP_city = $data->city;
        if ($ext_IP_city == "-") $ext_IP_city = "(UNKNOWN)";
    } else if ($config['geolocation_db'] == "MaxMind") {
        $GEO_database = geoip_open("../".$config['maxmind_path'], GEOIP_STANDARD);
        $data = geoip_record_by_addr($GEO_database, $ext_IP);
       
        //error_log('data '.$data->country->name);
	$region=geoip_country_id_by_addr($GEO_database, $ext_IP);
        //error_log('data region '.$region);
        if (isset($data->country->name)) {
            $ext_IP_country = strtoupper($data->country->name);
        }
        if (!isset($ext_IP_country) || $ext_IP_country == "") $ext_IP_country = "(UNKNOWN)";
//	error_log('ext_IP_country '.$ext_IP_country);
//	error_log('isoCode region'.$data->country->isoCode.'  '.$region);
        if (isset($data->country->isoCode) && isset($region)
                && array_key_exists($data->country->isoCode, $GEOIP_REGION_NAME)
                && array_key_exists($data->country->name, $GEOIP_REGION_NAME[$data->country->isoCode])) {
            $ext_IP_region = strtoupper($GEOIP_REGION_NAME[$data->country->isoCode][$data->country->name]);
        }
        if (!isset($ext_IP_region) || $ext_IP_region == "") $ext_IP_region = "(UNKNOWN)";

        if (isset($data->city->name)) {
            $ext_IP_city = strtoupper($data->city->name);
        }
        if (!isset($ext_IP_city) || $ext_IP_city == "") $ext_IP_city = "(UNKNOWN)";
    } else {
        $ext_IP_country = "(UNKNOWN)";
        $ext_IP_region = "(UNKNOWN)";
        $ext_IP_city = "(UNKNOWN)";
    }
    
    $ext_IP_country = fix_comma_separated_name(utf8_encode($ext_IP_country));
    $ext_IP_region = fix_comma_separated_name(utf8_encode($ext_IP_region));
    $ext_IP_city = fix_comma_separated_name(utf8_encode($ext_IP_city));
    
    // No geocoding needed if country is unknown
    if ($ext_IP_country != "(UNKNOWN)") {
        $geocode_place = $ext_IP_country;
        
        if ($ext_IP_region != "(UNKNOWN)") {
            $geocode_place .= ", ".$ext_IP_region;
        }
        if ($ext_IP_city != "(UNKNOWN)") {
            $geocode_place .= ", ".$ext_IP_city;
        }
        
        //$lat_lng = geocode($geocode_place);
    }
    
    $location = $ext_IP_country.",".$ext_IP_region.",".$ext_IP_city;
	$lat=$data->location->latitude;
	$lng=$data->location->longitude;
	$lat_lng=array($lat, $lng);
    if (isset($lat_lng) && is_array($lat_lng)) {
        $location .= ",".$lat_lng[0].",".$lat_lng[1];
    } else {
        $location .= ",(UNKNOWN),(UNKNOWN)";
    }
   

?>

<!DOCTYPE html>
<html>
    <head>
        <title>SURFmap / Retrieve Location</title>
        <meta http-equiv="content-type" content="text/html; charset=utf-8"/>
    </head>
    <body>
        <h1>SURFmap / Retrieve Location</h1>
            
        <div id="setup_guidelines">You can use the following settings in config.php:<br /><br /></div>      
        <div id="config_data" style="display:none;"><?php echo $location; ?></div>
        
        <script type="text/javascript">
            var NAT_IP = "<?php if (isset($NAT_IP)) { echo $NAT_IP; } ?>";
            var ext_IP = "<?php echo $ext_IP; ?>";
            var ext_IP_NAT = <?php if ($ext_IP_NAT === true) echo "1"; else echo "0"; ?>;
            var ext_IP_error = "<?php if (isset($ext_IP_error)) echo $ext_IP_error; ?>";
            var ext_IP_country = "<?php echo $ext_IP_country; ?>";
            var ext_IP_region = "<?php echo $ext_IP_region; ?>";
            var ext_IP_city = "<?php echo $ext_IP_city; ?>";
            var ext_IP_coordinates = "<?php if (isset($lat_lng) && is_array($lat_lng)) { echo $lat_lng[0].','.$lat_lng[1]; } ?>";
            var first_internal_domain = "<?php reset($config['internal_domains']); echo key($config['internal_domains']); ?>";

            // Setup guidelines
            if (ext_IP_coordinates != "") {
                document.getElementById("setup_guidelines").innerHTML += "$config['map_center']=\"" + ext_IP_coordinates + "\";<br /><br />";
            }
            
            if ((ext_IP_NAT && (NAT_IP == ext_IP)) || ext_IP_error != "") {
                document.getElementById("setup_guidelines").style.display = "none";
            } else if (ext_IP_country != "(UNKNOWN)") {
                var region = (ext_IP_region == "(UNKNOWN)") ? "" : ext_IP_region;
                var city = (ext_IP_city == "(UNKNOWN)") ? "" : ext_IP_city;
                document.getElementById("setup_guidelines").innerHTML += "$config['internal_domains'] = array( <br />\
                                <span style=\"padding-left: 50px;\">\"" + first_internal_domain + "\" => array(\"country\" => \"" + ext_IP_country + "\", \"region\" => \"" + region + "\", \"city\" => \"" + city + "\")</span><br /> \
                        );"
            }
        </script>
    </body>
</html>
