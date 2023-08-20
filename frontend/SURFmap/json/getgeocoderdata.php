<?php
/******************************************************
 # getgeocoderdata.php
 # Author:      Rick Hofstede <r.j.hofstede@utwente.nl>
 # University of Twente, The Netherlands
 # Adapt to OpenLayer by Emmanuel.Reuter@ird.fr
 # Franch Institue for Research and Development
 #
 # LICENSE TERMS: 3-clause BSD license (outlined in license.html)
 *****************************************************/

    require_once("../constants.php");
    header("content-type: application/json");
    require_once("../lib/MaxMind/geoiplatlon.inc");

    $result = array();
    $place = "";

    if (isset($_POST['params'])) {
        $requests = $_POST['params'];
    } else {
        $result['status'] = 1;
        $result['status_message'] = "No parameters provided";
        echo json_encode($result);
        die();
    }
    
    try {
        $db = new PDO("sqlite:../".$constants['cache_db']);
        $result['geocoder_data'] = array();
	$place_level="city";
        foreach ($requests as $request) {
            // Length of $split_request determines level (1 -> country, 2 -> region, 3 -> city)
		$split_request = explode(";", $request);
		//$place = end($split_request); // Récupère le dernier élément du tableau
		$place = $split_request[count($split_request)-2]; // Récupère le dernier élément du tableau

		// Si le dernier élément est vide, recherche le premier élément non vide en remontant le tableau
		if ($place === "") {
    			for ($i = count($split_request) - 2; $i >= 0; $i--) {
        			if ($split_request[$i] !== "") {
            				$place = $split_request[$i];
            				break;
        			}
    			}
		}
      	    $place=$decodedText = utf8_decode($place);
            if ($place === "-" || stripos($place, "NKNOWN")) {
                $lat = 0;
                $lng = 0;
            } else {
		$place=str_replace("'", " ", $place);
                $query = "SELECT latitude, longitude FROM geocoder_cache WHERE location = '$place'";
                $stmnt = $db->prepare($query);
                $stmnt->execute();
                $query_result = $stmnt->fetch(PDO::FETCH_ASSOC);

                if ($query_result) { // Country name was found in DB
			//error_log("QUERY RESULT OK  ");        
                    $lat = $query_result['latitude'];
                    $lng = $query_result['longitude'];
                } else {
			$place=str_replace("'", " ", $place);
       			$query="SELECT latitude, longitude FROM geocoder_cache WHERE location = '$place'";
			$query.= " UNION "."SELECT latitude, longitude FROM regions WHERE region = '$place'";
			$query.= " UNION "."SELECT latitude, longitude FROM country WHERE name = '$place'";
                	$stmnt = $db->prepare($query);
                	$stmnt->execute();
                	$query_result = $stmnt->fetch(PDO::FETCH_ASSOC);

                	if ($query_result) { // Country name was found in DB
                        	//error_log("QUERY RESULT OK  ");
                    		$lat = $query_result['latitude'];
                    		$lng = $query_result['longitude'];
                	} else {
                   		// worth case..
                    		$coordinates= getCoordinates($place);
                    		$lat = $coordinates["latitude"];
                    		$lng = $coordinates["longitude"];
                    		$place_level="worth case";
                	}

                }
            }
		if ($lat == -1) { 
            		error_log(' geocoderdata '.$place.' ('.$place_level.')  request '.$request.'  lat '.$lat.'  lng '.$lng);
		}
            array_push($result['geocoder_data'], array('request' => $request, 'lat' => $lat, 'lng' => $lng));
        }
        unset($request);
    } catch(PDOException $e) {
        $result['status'] = 1;
        $result['status_message'] = "A PHP PDO driver has occurred";
        echo json_encode($result);
        die();
    }

    $result['status'] = 0;
    echo json_encode($result);
    die();

?>
