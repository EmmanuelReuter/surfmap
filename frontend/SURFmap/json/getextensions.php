<?php
/******************************************************
 # getconfig.php
 # Author:      Rick Hofstede <r.j.hofstede@utwente.nl>
 # University of Twente, The Netherlands
 # Adapt to OpenLayer by Emmanuel.Reuter@ird.fr
 # Franch Institue for Research and Development
 #
 # LICENSE TERMS: 3-clause BSD license (outlined in license.html)
 *****************************************************/

    require_once("../extensions.php");
    header("content-type: application/json");

    $result = array();

    if (!isset($extensions)) {
        $result['status'] = 1;
        $result['status_message'] = "Could not find extensions file (extensions.php)";
        echo json_encode($result);
        die();   
    }

    $result['extensions'] = $extensions;
    $result['status'] = 0;
    echo json_encode($result);
    die();

?>
