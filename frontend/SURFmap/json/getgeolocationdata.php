<?php
/******************************************************
 # getgeolocationdata.php
 # Author:      Rick Hofstede <r.j.hofstede@utwente.nl>
 # University of Twente, The Netherlands
 # Adapt to OpenLayer by Emmanuel.Reuter@ird.fr
 # Franch Institue for Research and Development
 #
 # LICENSE TERMS: 3-clause BSD license (outlined in license.html)
 *****************************************************/

    require_once("../config.php");
    require_once("../util.php");

if (!defined("MODULE_GEOIP")) {
    include("../lib/MaxMind/geoipcity.inc");
}

    require_once("../lib/IP2Location/ip2location.class.php");
    header("content-type: application/json");

    if (isset($_POST['params'])) {
        $request = $_POST['params'];
    } else {
        $result['status'] = 1;
        $result['status_message'] = "No parameters provided";
        echo json_encode($result);
        die();
    }
    
    $result = array();
    $result['geolocation_data'] = array();
    
    // Open database connections
    if ($config['geolocation_db'] == "IP2Location") {
        $db = new ip2location();
        $db->open("../".$config['ip2location_path']);
    } else if ($config['geolocation_db'] == "MaxMind") {
        $db = geoip_open("../".$config['maxmind_path'], GEOIP_STANDARD);
    } else {}
    
    foreach ($request as $address) {
        $country = "";
        $region = "";
        $city = "";
        $continent = "";

	if (strcmp($address, "0.0.0.0")==0) continue;
        
        foreach ($config['internal_domains'] as $key => $value) {
            $internal_domain_networks = explode(";", $key);
            
            /*
             * Check whether a NATed setup was used. If so, use the geolocation data provided
             * in the configuration file. Otherwise, use a geolocation service.
             */
		//error_log( "NATed ".$key."  ".$value."\n");


            $internal_address = false;
            foreach ($internal_domain_networks as $subnet) {
                if (ip_address_in_net($address, $subnet)) {
                    $country = ($value['country'] === "") ? "(UNKNOWN)" : strtoupper($value['country']);
                    $region = ($value['region'] === "") ? "(UNKNOWN)" : strtoupper($value['region']);
                    $city = ($value['city'] === "") ? "(UNKNOWN)" : strtoupper($value['city']);
                    break;
                }
            }
            unset($subnet);
            
            // Since matching internal domain has been found, there's no need to iterate over other internal domains
            if ($country != "" || $region != "" || $city != "") break;
        }
        unset($key, $value);
        
        if ($country == "" || $region == "" || $city == "") {
            if ($config['geolocation_db'] == "IP2Location") {
                if (strpos($address, ":") === false) { // IPv4 address
                    $data = $db->getAll($address);
                    $country = ($data->countryLong === "-") ? "(UNKNOWN)" : $data->countryLong;
                    $region = ($data->region === "-") ? "(UNKNOWN)" : $data->region;
                    $city = ($data->city === "-") ? "(UNKNOWN)" : $data->city;
                } else { // IPv6 address
                    $country = "(UNKNOWN)";
                    $region = "(UNKNOWN)";
                    $city = "(UNKNOWN)";
                }
                
                // IP2Location does not feature continent information
            } else if ($config['geolocation_db'] == "MaxMind") {
		try {
                if (strpos($address, ":") === false) { // IPv4 address
                    $data = geoip_record_by_addr($db, $address);
			$continent=  geoip_continent_by_addr($db,$address);
                } else { // IPv6 address
                    $data = geoip_record_by_addr_v6($db, $address);
			$continent=  geoip_continent_by_addr_v6($db,$address);
                }
		$region=$data->mostSpecificSubdivision->name;
		$country=$data->country->name;
		$city=$data->city->name ;
		} catch (Exception $e) {
			$country = "(UNKNOWN)";
                	$region = "(UNKNOWN)";
                	$city = "(UNKNOWN)";
       error_log(" address ".$address.','.$continent.', '.$country.', '.$region.', '.$city); 
		}
            
            } else {
                $country = "(UNKNOWN)";
                $region = "(UNKNOWN)";
                $city = "(UNKNOWN)";
                $continent = "(UNKNOWN)";
            }
        }
        
        $country = fix_comma_separated_name(utf8_encode($country));
        $region = fix_comma_separated_name(utf8_encode($region));
        $city = fix_comma_separated_name(utf8_encode($city));
        $continent = fix_comma_separated_name(utf8_encode($continent));
        
        array_push($result['geolocation_data'], array('address' => $address, 'continent' => $continent, 'country' => $country, 'region' => $region, 'city' => $city));
        unset($continent_code, $continent);
    }
    unset($address);
    
    // Close database connections
    if ($config['geolocation_db'] == "MaxMind") {
        geoip_close($db);
    }
    unset($db);

    $result['status'] = 0;
    echo json_encode($result);
    die();

function isRequiredFileIncluded($filename) {
    $included_files = get_included_files();
    return in_array($filename, $included_files);
}

?>
