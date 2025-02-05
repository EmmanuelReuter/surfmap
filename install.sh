#!/bin/sh

#########################################################
#
# Installation script for SURFmap.
#
# Copyright (C) 2013 INVEA-TECH a.s.
# Author(s):    Rick Hofstede   <r.j.hofstede@utwente.nl>
#               Pavel Celeda    <celeda@invea-tech.com>
# Contributor :
# Emmanuel Reuter, < emmanuel.reuter@ird.fr>
# French Institute for Research and Developpement
#
# LICENSE TERMS - 3-clause BSD license
#
# $Id$
#
#########################################################

VERSION=4.0.1
SURFMAP_REL=SURFmap_v${VERSION}.tar.gz
TMP_DIR=SURFmap
GEO_DB=GeoLiteCity.dat.gz
GEOv6_DB=GeoLiteCityv6.dat.gz

err () {
    printf "ERROR: ${*}\n"
    exit 1
}

err_line () {
    echo "-----"
    printf "ERROR: ${*}\n"
    exit 1
}

FRONTEND_ONLY=0             # Install/update frontend only
BACKEND_ONLY=0              # Install/update backend only
NFSEN_CONF_OVERWRITE=""     # Overwrite path to nfsen.conf (i.e., don't determine path automatically)

# http://wiki.bash-hackers.org/howto/getopts_tutorial
while getopts ":fbn:" opt; do
    case $opt in
        f)
            FRONTEND_ONLY=1
            ;;
        b)
            BACKEND_ONLY=1
            ;;
        n)
            NFSEN_CONF_OVERWRITE=$OPTARG
            ;;
        \?)
            err "Invalid option: -$OPTARG"
            exit 1
            ;;
        :)
            err "Option -$OPTARG requires an argument. Exiting..."
            exit 1
            ;;
    esac
done

if [ $FRONTEND_ONLY = 1 -a $BACKEND_ONLY = 1 ]; then
    err "You have specified two excluding options (-f and -b)."
fi

# Determine (based on combination of input parameters) whether frontend has to be installed
if [ $FRONTEND_ONLY = 1 ] || [ $FRONTEND_ONLY = 0 -a $BACKEND_ONLY = 0 ]; then
    INSTALL_FRONTEND=1
else
    INSTALL_FRONTEND=0
fi

# Determine (based on combination of input parameters) whether backend has to be installed
if [ $BACKEND_ONLY = 1 ] || [ $FRONTEND_ONLY = 0 -a $BACKEND_ONLY = 0 ]; then
    INSTALL_BACKEND=1
else
    INSTALL_BACKEND=0
fi

echo "SURFmap installation script"
echo "---------------------------"

# Check PHP dependencies
PHP_CURL=$(php -m | grep 'curl' 2> /dev/null)
PHP_JSON=$(php -m | grep 'json' 2> /dev/null)
PHP_MBSTRING=$(php -m 2> /dev/null | grep 'mbstring')
PHP_PDOSQLITE=$(php -m 2> /dev/null | grep 'pdo_sqlite$') # The dollar-sign ($) makes sure that 'pdo_sqlite2' is not accepted
PHP_SOCKETS=$(php -m 2> /dev/null | grep '^sockets$')
PHP_XML=$(php -m 2> /dev/null | grep '^xml$')

if [ "$PHP_CURL" != "curl" ]; then
    err "The PHP 'CURL' module is missing.\nDon't forget to restart your Web server after installing the package."
elif [ "$PHP_JSON" != "json" ]; then
    err "The PHP 'JSON' module is missing.\nDon't forget to restart your Web server after installing the package."
elif [ "$PHP_MBSTRING" != "mbstring" ]; then
    err "The PHP 'mbstring' module is missing.\nDon't forget to restart your Web server after installing the package."
elif [ "$PHP_PDOSQLITE" != "pdo_sqlite" ]; then
    err "The PHP PDO SQLite v3 module is missing.\nDon't forget to restart your Web server after installing the package."
elif [ "$PHP_SOCKETS" != "sockets" ]; then
    err "The PHP 'sockets' module is missing.\nDon't forget to restart your Web server after installing the package."
elif [ "$PHP_XML" != "xml" ]; then
    err "The PHP 'xml' module is missing.\nDon't forget to restart your Web server after installing the package."
fi

# Discover NfSen configuration
NFSEN_VARFILE=/tmp/nfsen-tmp.conf
if [ ! -n "$(ps axo command | grep [n]fsend | grep -v nfsend-comm)" ]; then
    err "NfSen - nfsend not running; cannot detect nfsen.conf location. Exiting..."
fi

NFSEN_LIBEXECDIR=$(cat $(ps axo command= | grep -vE "(nfsend-comm|grep)" | grep -Eo "[^ ]+nfsend") | grep libexec | cut -d'"' -f2 | head -n 1)

if [ -z "${NFSEN_CONF_OVERWRITE}" ]; then
    NFSEN_CONF=$(cat ${NFSEN_LIBEXECDIR}/NfConf.pm | grep \/nfsen.conf | cut -d'"' -f2)
else
    NFSEN_CONF=$NFSEN_CONF_OVERWRITE
fi

# Parse nfsen.conf file
cat ${NFSEN_CONF} | grep -v \# | egrep '\$BASEDIR|\$BINDIR|\$LIBEXECDIR|\$HTMLDIR|\$FRONTEND_PLUGINDIR|\$BACKEND_PLUGINDIR|\$WWWGROUP|\$WWWUSER|\$USER' | tr -d ';' | tr -d ' ' | cut -c2- | sed 's,/",",g' > ${NFSEN_VARFILE}
. ${NFSEN_VARFILE}
rm -rf ${NFSEN_VARFILE}

SURFMAP_CONF=${FRONTEND_PLUGINDIR}/SURFmap/config.php

# Check permissions to install SURFmap - you must be ${USER} or root
if [ "$(id -u)" != "$(id -u ${USER})" ] && [ "$(id -u)" != "0" ]; then
    err "You do not have sufficient permissions to install SURFmap on this machine!"
fi

if [ "$(id -u)" = "$(id -u ${USER})" ]; then
    WWWUSER=${USER}     # we are installing as normal user
fi

# Download files from Web
if [ $(uname) = "FreeBSD" -o $(uname) = "OpenBSD" ]; then
    RETRIEVE_TOOL="fetch"
else
    RETRIEVE_TOOL="wget"
fi

if [ ! -f ${SURFMAP_REL} ]; then
    echo "Downloading SURFmap tar ball - http://surfmap.sf.net/"
    ${RETRIEVE_TOOL} -q http://downloads.sourceforge.net/project/surfmap/source/${SURFMAP_REL}

    if [ ! -f ${SURFMAP_REL} ]; then
        err "Could not download SURFmap tar ball; please check whether the version (v${VERSION}) is still available for download"
    fi
fi

# Unpack SURFmap
if [ -d ${TMP_DIR} ]; then
    # Assume tar-ball was already extracted before
    echo "Extracted SURFmap files found in $(pwd)/${TMP_DIR}"
elif [ -d backend -a -d frontend ]; then
    # Assume tar-ball was already extracted before and we're already inside the 'SURFmap' directory
    # Move one directory-level up, if necessary, to be consistent with the IF and ELSE clauses
    cd ..
else
    echo "Unpacking files..."
    tar zxf ${SURFMAP_REL} --directory=.

    if [ ! -d ${TMP_DIR} ]; then
        mv SURFmap ${TMP_DIR}
    fi
fi

if [ ! -f ${GEO_DB} ]; then
    echo "Downloading MaxMind GeoLite City database - http://geolite.maxmind.com"
    ${RETRIEVE_TOOL} -q http://geolite.maxmind.com/download/geoip/database/${GEO_DB}
    if [ $? != 0 ]; then
        err_line "The MaxMind GeoLite City database has not been downloaded successfully. You may have been graylisted by MaxMind because of subsequent download retries. Please try again later."
    fi
fi

if [ ! -f ${GEOv6_DB} ]; then
    echo "Downloading MaxMind GeoLite City (IPv6) database - http://geolite.maxmind.com"
    ${RETRIEVE_TOOL} -q http://geolite.maxmind.com/download/geoip/database/GeoLiteCityv6-beta/${GEOv6_DB}
    if [ $? != 0 ]; then
        err_line "The MaxMind GeoLite City (IPv6) database has not been downloaded successfully. You may have been graylisted by MaxMind because of subsequent download retries. Please try again later."
    fi
fi

# Backup old SURFmap installation
SURFMAP_BACKUPDIR_FRONTEND=${FRONTEND_PLUGINDIR}/SURFmap-$(date +%s)
SURFMAP_BACKUPDIR_BACKEND=${BACKEND_PLUGINDIR}/SURFmap-$(date +%s)
if [ $INSTALL_FRONTEND = 1 -a -d ${FRONTEND_PLUGINDIR}/SURFmap ]; then
    echo "Backing up existing SURFmap (frontend) installation to ${SURFMAP_BACKUPDIR_FRONTEND}"
    mv ${FRONTEND_PLUGINDIR}/SURFmap ${SURFMAP_BACKUPDIR_FRONTEND}
fi
if [ $INSTALL_BACKEND = 1 -a -d ${BACKEND_PLUGINDIR}/SURFmap ]; then
    echo "Backing up existing SURFmap (backend) installation to ${SURFMAP_BACKUPDIR_BACKEND}"
    mv ${BACKEND_PLUGINDIR}/SURFmap ${SURFMAP_BACKUPDIR_BACKEND}
fi

# Install backend and frontend plugin files
echo "Installing SURFmap ${VERSION} to ${FRONTEND_PLUGINDIR}/SURFmap"
if [ $INSTALL_FRONTEND = 1 ]; then
    cp -r ./${TMP_DIR}/frontend/* ${FRONTEND_PLUGINDIR}
fi
if [ $INSTALL_BACKEND = 1 ]; then
    cp -r ./${TMP_DIR}/backend/* ${BACKEND_PLUGINDIR}
fi

# Unpack geoLocation databases
MAXMIND_PATH=${FRONTEND_PLUGINDIR}/SURFmap/lib/MaxMind
echo "Installing MaxMind GeoLite City database to ${MAXMIND_PATH}"
gunzip -c ${GEO_DB} > ${MAXMIND_PATH}/$(basename ${GEO_DB} .gz)
if [ $? != 0 ]; then
    err_line "The MaxMind GeoLite City database has not been downloaded successfully. You may have been graylisted by MaxMind because of subsequent download retries. Please try again later."
fi

echo "Installing MaxMind GeoLite City (IPv6) database to ${MAXMIND_PATH}"
gunzip -c ${GEOv6_DB} > ${MAXMIND_PATH}/$(basename ${GEOv6_DB} .gz)
if [ $? != 0 ]; then
    err_line "The MaxMind GeoLite City (IPv6) database has not been downloaded successfully. You may have been graylisted by MaxMind because of subsequent download retries. Please try again later."
fi

# Deleting temporary files
rm -rf ${GEO_DB}
rm -rf ${GEOv6_DB}

# Check whether an old SURFmap version was found and ask whether frontend configuration and data structures should be retained
if [ $INSTALL_FRONTEND = 1 -a -d ${SURFMAP_BACKUPDIR_FRONTEND} ]; then
    OLD_VER=$(cat ${SURFMAP_BACKUPDIR_FRONTEND}/version.php | grep -m1 \$version | awk '{print $3}' |  cut -d"\"" -f2)
    if [ ${OLD_VER} = ${VERSION} ]; then
        while true; do
            read -p "Do you wish to keep the frontend configuration and data structures from your previous installation [y,n] (default: y)? " input
            case $input in
                [Nn]* ) break;;
                * )     echo "Copying backend configuration and data structures from previous installation..."
                        cp ${SURFMAP_BACKUPDIR_FRONTEND}/config.php ${FRONTEND_PLUGINDIR}/SURFmap/;
                        cp ${SURFMAP_BACKUPDIR_FRONTEND}/db/* ${FRONTEND_PLUGINDIR}/SURFmap/db/;
                        break;;
            esac
        done
    fi
fi

# Set permissions - owner and group
echo "Setting plugin file permissions - user \"${USER}\" and group \"${WWWGROUP}\""
if [ $INSTALL_FRONTEND = 1 ]; then
    chown -R ${USER}:${WWWGROUP} ${FRONTEND_PLUGINDIR}/SURFmap*
    chmod -R g+w ${FRONTEND_PLUGINDIR}/SURFmap/db
fi
if [ $INSTALL_BACKEND = 1 ]; then
    chown -R ${USER}:${WWWGROUP} ${BACKEND_PLUGINDIR}/SURFmap*
fi

# Update plugin configuration file - config.php. We use ',' as sed delimiter instead of escaping all '/' to '\/'.
echo "Updating plugin configuration file ${SURFMAP_CONF}"

# Check for proxy and update config.php accordingly
PROXY=$(env | grep -i http_proxy | awk '{ START=index($0,"=")+1; print substr($0,START) }')
if [ "$PROXY" != "" ]; then
    echo "HTTP proxy detected"
    sed -i.tmp "s,config\['use_proxy'\] = 0,config\['use_proxy'\] = 1,g" ${SURFMAP_CONF}
    
    PROXY_IP_PORT=$(echo ${PROXY} | awk '{ FROM=index($0,"//")+2; print substr($0,FROM) }')
    PROXY_IP=$(echo ${PROXY_IP_PORT} | awk '{ TO=index($0,":")-1; print substr($0,0,TO) }')
    PROXY_PORT=$(echo ${PROXY_IP_PORT} | awk '{ FROM=index($0,":")+1; print substr($0,FROM) }')
    
    OLD_PROXY_IP=$(grep "$config\['proxy_ip'\]" ${SURFMAP_CONF} | cut -d'"' -f2)
    OLD_PROXY_PORT=$(grep "$config\['proxy_port'\]" ${SURFMAP_CONF} | awk '{ FROM=index($0,"=")+2; TO=index($0,";"); print substr($0,FROM,TO-FROM) }')
    
    sed -i.tmp "s,${OLD_PROXY_IP},${PROXY_IP},g" ${SURFMAP_CONF}
    sed -i.tmp "s,${OLD_PROXY_PORT},${PROXY_PORT},g" ${SURFMAP_CONF}
fi

# Get my location information
cd ${FRONTEND_PLUGINDIR}/SURFmap/setup
MY_LOC=$(php retrievelocation.php | grep config_data | cut -d'>' -f2 | cut -d'<' -f1)
echo "Geocoding plugin location - ${MY_LOC}"

cd - > /dev/null

# Fill my location in plugin configuration file
if [ "${MY_LOC}" != "(UNKNOWN),(UNKNOWN),(UNKNOWN),(UNKNOWN),(UNKNOWN)" ]; then
    OLDENTRY=$(grep internal_domains ${SURFMAP_CONF} | cut -d'"' -f 6)
    sed -i.tmp "s/${OLDENTRY}/$(echo ${MY_LOC} | cut -d',' -f1)/g" ${SURFMAP_CONF}

    OLDENTRY=$(grep internal_domains ${SURFMAP_CONF} | cut -d'"' -f 10)
    NEWENTRY=$(echo ${MY_LOC} | cut -d',' -f2)
    if [ "${NEWENTRY}" = "(UNKNOWN)" ]; then
        NEWENTRY=""
    fi
    sed -i.tmp "s/${OLDENTRY}/${NEWENTRY}/g" ${SURFMAP_CONF}

    OLDENTRY=$(grep internal_domains ${SURFMAP_CONF} | cut -d'"' -f 14)
    NEWENTRY=$(echo ${MY_LOC} | cut -d',' -f3)
    if [ "${NEWENTRY}" = "(UNKNOWN)" ]; then
        NEWENTRY=""
    fi
    sed -i.tmp "s/${OLDENTRY}/${NEWENTRY}/g" ${SURFMAP_CONF}

    OLDENTRY=$(grep "$config\['map_center'\]" ${SURFMAP_CONF} | cut -d'"' -f2)
    NEWENTRY=$(echo ${MY_LOC} | cut -d',' -f4,5)
    if [ "${NEWENTRY}" != "(UNKNOWN),(UNKNOWN)" ]; then
        sed -i.tmp "s/${OLDENTRY}/${NEWENTRY}/g" ${SURFMAP_CONF}
    fi
fi

# Enable plugin
OLDENTRY=$(grep \@plugins ${NFSEN_CONF})

if grep "SURFmap" ${NFSEN_CONF} > /dev/null; then
    echo "Found 'SURFmap' in ${NFSEN_CONF}; assuming it is already configured"
else
    echo "Updating NfSen configuration file ${NFSEN_CONF}"
    
    # Check whether we are running Linux of BSD (BSD sed does not support inserting new lines (\n))
    if [ $(uname) = "Linux" ]; then
        sed -i.tmp "/SURFmap/d" ${NFSEN_CONF}
        sed -i.tmp "s/${OLDENTRY}/${OLDENTRY}\n    \[ 'live', 'SURFmap' ],/g" ${NFSEN_CONF}
    else # Something else (we assume *BSD)
        sed -i.tmp "s/${OLDENTRY}/${OLDENTRY}\ \[ 'live', 'SURFmap' ],/g" ${NFSEN_CONF}
    fi
fi

# Check whether an old SURFmap version was found and ask whether the backup of that version should be removed
if [ -d ${SURFMAP_BACKUPDIR_FRONTEND} -a -d ${SURFMAP_BACKUPDIR_BACKEND} ]; then
    while true; do
        read -p "Do you wish to remove the backup of your previous SURFmap installation [y,n] (default: n)? " input
        case $input in
            [Yy]* ) echo "Removing backup of previous installation..."
                    rm -rf ${SURFMAP_BACKUPDIR_FRONTEND} ${SURFMAP_BACKUPDIR_BACKEND}; 
                    break;;
            * )     break;;
        esac
    done
fi

echo "-----"
echo "Please restart/reload NfSen to finish installation (e.g., sudo ${BINDIR}/nfsen reload)"
