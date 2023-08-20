<?php
/******************************************************
 # getversion.php
 # Author:      Rick Hofstede <r.j.hofstede@utwente.nl>
 # University of Twente, The Netherlands
 # Adapt to OpenLayer by Emmanuel.Reuter@ird.fr
 # Franch Institue for Research and Development
 #
 # LICENSE TERMS: 3-clause BSD license (outlined in license.html)
 *****************************************************/

    require_once("../config.php");
    header("content-type: application/json");

    $result = array();
    
    if (isset($_POST['params'])) {
        $current_version = $_POST['params']['current_version'];
        $update_type = $_POST['params']['type'];
        $user_agent = $_POST['params']['user_agent'];
    } else {
        $result['status'] = 1;
        $result['status_message'] = "No parameters provided";
        echo json_encode($result);
        die();
    }
    
    if (extension_loaded('curl')) {
        $ch = curl_init();
        $options = array(
                CURLOPT_URL => 'http://surfmap.sourceforge.net/get_version_number.php',
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
		CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_POSTFIELDS => array(
                    'current_version' => urlencode($current_version),
                    'type' => urlencode($update_type),
                    'user_agent' => urlencode($user_agent)
                )
        );
        
        if ($config['use_proxy']) {
            curl_setopt($ch, CURLOPT_PROXYTYPE, $config['proxy_type']);
            curl_setopt($ch, CURLOPT_PROXY, $config['proxy_ip']);
            curl_setopt($ch, CURLOPT_PROXYPORT, $config['proxy_port']);

            if ($config['proxy_user_authentication']) {
                curl_setopt($ch, CURLOPT_PROXYUSERPWD, $config['proxy_username'].":".$config['proxy_password']);
            }
        }
        
        curl_setopt_array($ch, $options);
        $version = curl_exec($ch);
        if ($version === false && curl_error($ch) == "name lookup timed out") {
            curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
            $version = curl_exec($ch);
        }
        
        curl_close($ch);
        
        $version = json_decode($version, true);
        $version = $version['version'];
    } else {
        $result['status'] = 1;
        $result['status_message'] = "PHP cURL module is not installed";
        echo json_encode($result);
        die();
    }

    $result['version'] = $version;
    $result['status'] = 0;
    echo json_encode($result);
    die();

?>
