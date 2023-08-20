<?php
/******************************************************
 # writetosyslog.php
 # Author:      Rick Hofstede <r.j.hofstede@utwente.nl>
 # University of Twente, The Netherlands
 # Adapt to OpenLayer by Emmanuel.Reuter@ird.fr
 # Franch Institue for Research and Development
 #
 # LICENSE TERMS: 3-clause BSD license (outlined in license.html)
 *****************************************************/
    
    header("content-type: application/json");

    $result = array();
    
    if (!isset($_POST['params'])) {
        $result['status'] = 1;
        $result['status_message'] = "No parameters provided";
        echo json_encode($result);
        die();
    }
    
    if ($_POST['params']['type'] == "error") {
        $log_type = LOG_ERR;
    } else if ($_POST['params']['type'] == "debug") {
        $log_type = LOG_DEBUG;
    } else {
        $log_type = LOG_INFO;
    }
    
    foreach ($_POST['params']['lines'] as $line) {
        if ($log_type == LOG_DEBUG) {
            $line = "[DEBUG] ".$line;
        }
        syslog($log_type, "SURFmap: ".$line);
    }
    unset($line);
    
    $result['status'] = 0;
    echo json_encode($result);
    die();

?>
