<?php
    /*******************************
     # constants.php [SURFmap]
     # Author: Rick Hofstede <r.j.hofstede@utwente.nl>
     # University of Twente, The Netherlands
     # Adapt to OpenLayer by Emmanuel.Reuter@ird.fr
     # Franch Institue for Research and Development
     #
     # LICENSE TERMS: 3-clause BSD license (outlined in license.html)
     *******************************/
    
    $constants['cache_db'] = "db/surfmap.sqlite"; // Path to the SQLite3 database file [default: 'db/surfmap.sqlite']
    $constants['default_geocoder_request_interval'] = 250; // Time between subsequent geocoder requests in ms [default: 250]
    $constants['refresh_interval'] = 300; // Page auto-refresh interval in seconds [default: 300]
    
?>
