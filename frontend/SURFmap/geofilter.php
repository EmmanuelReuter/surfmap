<?php
	/******************************
	 # geofilter.php [SURFmap]
	 # Author: Rick Hofstede <r.j.hofstede@utwente.nl>
	 # University of Twente, The Netherlands
	 #
	 # LICENSE TERMS: outlined in BSD-license.html
	 *******************************/
	
	require_once("iso3166.php");
	
	/*
	 * Validates the provided object against the provided expression.
	 * Parameters:
	 *		object - single object (SURFmap geolocation style) to validate.
	 * Return:
	 *		True, if the expression validated to true against the object. Otherwise,
	 *		false.
	 */	
	function evaluateGeoFilter ($object, $expression) {
		global $logicOperators, $originOperators, $geolocationOperators;
		
		$expression = trim($expression); // Removes unwanted chars from *beginning* and *end*
		$expression = str_replace("\n", "", $expression);
		$expression = str_replace("\r", "", $expression);
		
		if (empty($expression)) {
			return true;
		} else if (containsLogicOperator($expression) !== false || containsBrackets($expression) !== false) { // expression needs to be truncated
			$outerExpressions = getOuterFilterExpressions($expression); // returns array
			
			$result = null;
			$currentLogicOperator = null;
			$currentLogicNegationOperator = null;

			foreach ($outerExpressions as $outerExpression) {
				if (strcasecmp($outerExpression, "not") === 0) {
					$currentLogicNegationOperator = true;
				} else if (isset($currentLogicNegationOperator) && $currentLogicNegationOperator === true) {
					$result = performLogicNegation(evaluateGeoFilter($object, $outerExpression));
					$currentLogicNegationOperator = null;
				} else if (in_arrayi($outerExpression, $logicOperators)) { // logic operator
					$currentLogicOperator = $outerExpression;
				} else if (isset($result)) { // second or later element of outer expression; $currentLogicOperator should therefore be set
					if (strcasecmp($currentLogicOperator, "and") === 0) {
						// If the first result in an 'and' operation is false, evaluation of the second expression can be skipped
						if ($result) $result = performLogicAND(array($result, evaluateGeoFilter($object, $outerExpression)));
					} else if (strcasecmp($currentLogicOperator, "or") === 0) { // logic OR
						// If the first result in an 'or' operation is true, evaluation of the second expression can be skipped
						if ($result === true) $result = performLogicOR(array($result, evaluateGeoFilter($object, $outerExpression)));
					} else {
						throw new GeoFilterException("Logic operator (and/or) is missing (near '$outerExpression')");
					}
					$currentLogicOperator = null;
				} else { // first element of outer expression
					$result = evaluateGeoFilter($object, $outerExpression);
				}
			}
			
			return $result;
		} else {
			$logicNegationOperator = getLogicNegationOperator($expression);
			$originOperator = getOriginOperator($expression);
			$geolocationOperator = getGeolocationOperator($expression);
			if ($geolocationOperator === false) {
				throw new GeoFilterException("Geolocation operator (country/region/city/ctry/rgn/cty) is missing (near '$expression')");
			}

			$filterValue = getFilterValue($expression, $logicNegationOperator, $originOperator, $geolocationOperator);
			foreach ($geolocationOperators as $operator => $objectMapping) {
				if (strpos($filterValue, $operator) !== false) {
					throw new GeoFilterException("Logic operator (and/or) is missing (near '$expression')");
				}
			}
			unset($operator, $objectMapping);

			if (strcasecmp($filterValue, "") === 0) {
				throw new GeoFilterException("Filter value is missing (near '$expression')");
			} else if (isCountryGeolocationOperator($geolocationOperator)) {
				// Check only country names/codes for validity, since only those are
				// standardized in ISO 3166.
				if (isValidCountryCode($filterValue)) {
					$filterValue = getCountryNameFromCode($filterValue);
				} else if (!isValidCountryName($filterValue)) {
					throw new GeoFilterException("Invalid filter value ($filterValue) (near '$expression')");
				}
			}

			// Case-insensitive comparisons
			if ($originOperator === false) { // ANY origin
				$srcResult = (strcasecmp($object[0][$geolocationOperators[$geolocationOperator]], $filterValue) === 0);
				$dstResult = (strcasecmp($object[0][$geolocationOperators[$geolocationOperator]], $filterValue) === 0);
				$result = performLogicOR(array($srcResult, $dstResult));
			} else {
				$result = (strcasecmp($object[$originOperators[$originOperator]][$geolocationOperators[$geolocationOperator]], $filterValue) === 0);
			}
			
			$result = ($logicNegationOperator) ? performLogicNegation($result) : $result;
			return $result;
		}
	}
	
	/*
	 * Checks whether the specified expression contains a logic operator (and/or).
	 * Parameters:
	 *		expression - expression.
	 * Return:
	 *		First found logic operator (String), in case it was found. Otherwise, 
	 *		false.
	 */
	function containsLogicOperator ($expression) {
		global $logicOperators;
		foreach ($logicOperators as $operator) {
			if (strpos($expression, " ".$operator) !== false) {
				return $operator;
			}
		}
		unset($operator);
		
		return false;
	}
	
	/*
	 * Checks whether the specified expression contains brackets (i.e. '(').
	 * Parameters:
	 *		expression - expression.
	 * Return:
	 *		Position of the first found 'opening' bracket (i.e. '(') (int), in case
	 *		it was found. Otherwise, false.
	 */	
	function containsBrackets ($expression) {
		$bracketPos = strpos($expression, "(");
		return ($bracketPos === false) ? false : $bracketPos;
	}
	
	/*
	 * Checks whether the specified expression contains a logic negation operator 
	 * 		(i.e. 'not').
	 * Parameters:
	 *		expression - expression.
	 * Return:
	 *		True, in case a logic negation operator was found. Otherwise, false.
	 */	
	function getLogicNegationOperator ($expression) {
		return (strpos($expression, 'not') !== false);
	}
	
	/*
	 * Gets the origin operator (i.e. 'src' or 'dst') in case it is present
	 * in the specified expression.
	 * Parameters:
	 *		expression - expression.
	 * Return:
	 *		First found origin operator, in case it was	found. Otherwise, false.
	 */	
	function getOriginOperator ($expression) {
		global $originOperators;
		foreach ($originOperators as $operator => $objectMapping) {
			if (strpos($expression, $operator) !== false) {
				return $operator;
			}
		}
		unset($operator, $objectMapping);
		
		return false;
	}
	
	/*
	 * Gets the geolocation operator (e.g. 'country' or 'ctry') in case it is present
	 * in the specified expression.
	 * Parameters:
	 *		expression - expression.
	 * Return:
	 *		First found geolocation operator, in case it was found. Otherwise, false.
	 */	
	function getGeolocationOperator ($expression) {
		global $geolocationOperators;
		foreach ($geolocationOperators as $operator => $objectMapping) {
			if (strpos($expression, $operator) !== false) {
				return $operator;
			}
		}
		unset($operator, $objectMapping);
		
		return false;
	}
	
	/*
	 * Gets the filter value (e.g. 'NL' or 'The Netherlands') in case it is present
	 * in the specified expression.
	 * Parameters:
	 *		expression - filter expression.
	 * Return:
	 *		First found filter value.
	 */	
	function getFilterValue ($expression, $logicNegationOperator, $originOperator, $geolocationOperator) {
		if ($geolocationOperator === false) return false;
		
		$operators = ($logicNegationOperator) ? "not " : "";
		
		if ($originOperator === false) $operators .= $geolocationOperator;
		else $operators .= "$originOperator $geolocationOperator";
		
		return substr($expression, strlen($operators) + 1);
	}
	
	/*
	 * Returns the outer filter expressions as an array.
	 * Parameters:
	 *		expression - filter expression.
	 */	
	function getOuterFilterExpressions ($expression) {
		if (containsLogicOperator($expression) === false && !containsBrackets($expression) === false) {
			return $expression;
		}
		
		global $logicOperators;

		$outerExpressions = array();
		$expressionDepth = 0;
		$minExpressionDepth = getMinimumExpressionDepth($expression);
		$subExpression = "";
		
		for ($i = 0; $i < strlen($expression); $i++) {
			$char = substr($expression, $i, 1);
		    
			if ($char === "(") {
				$expressionDepth++;

				// Flush current subexpression (e.g. in case of 'not (... ')
				if ($expressionDepth === ($minExpressionDepth + 1)) {
					$subExpression = trim($subExpression);
					
					if (!empty($subExpression)) {
						array_push($outerExpressions, $subExpression);
						$subExpression = "";
					}
				}
				
				if ($expressionDepth > $minExpressionDepth) {
					$subExpression .= $char;
				}
			} else if ($char === ")") {
				$expressionDepth--;
				
				// This is essential for expressions such as '(src ctry NL)' (to strip the last bracket properly)
				if ($expressionDepth >= $minExpressionDepth) {
					$subExpression .= $char;
				}
				
				// Flush current subexpression
				if ($expressionDepth === $minExpressionDepth) {
					$subExpression = trim($subExpression);
					
					if (!empty($subExpression)) {
						array_push($outerExpressions, $subExpression);
						$subExpression = "";
					}
				}			
			} else {
				$subExpression .= $char;
				
				// Check if last keyword was a logic operator
				if ($expressionDepth === $minExpressionDepth) {
					foreach ($logicOperators as $operator) {
						if (strpos($subExpression, " ".$operator) !== false) {
							$subExpression = trim(str_replace($operator, "", $subExpression));
							
							// Only add non-empty subexpression. Can be empty in
							// '(dst ctry CZ) and (src ctry NL)', for instance.
							if (!empty($subExpression)) {
								array_push($outerExpressions, $subExpression);
								$subExpression = "";
							}
							
							array_push($outerExpressions, trim($operator));

							// Since we check the presence of a logic operator principally
							// after each char, there can be at most one operator at a time
							break;
						}
					}
				}
			}
		}
		
		// Flush the 'character cache'
		if (!empty($subExpression)) {
			array_push($outerExpressions, trim($subExpression));
			$subExpression = "";
		}

		return $outerExpressions;
	}
	
	/*
	 * Determines the minimum expression 'depth' of the provided expression.
	 * Examples (hint: check 'and'):
	 * 		"(dst ctry CZ and (src ctry NL and src ctry DE)) and (src ctry NL or src ctry CZ)" => 0
	 * 		"((dst ctry CZ and (src ctry NL and src ctry DE)) and (src ctry NL or src ctry CZ))" => 1
	 * Parameters:
	 *		expression - expression.
	 */	
	function getMinimumExpressionDepth ($expression) {
		if (containsBrackets($expression) === false) {
			$minExpressionDepth = 0;
		} else {
			$currentExpressionDepth = 0;
			$minExpressionDepth = -1;

			for ($i = 0; $i < strlen($expression); $i++) {
				$char = substr($expression, $i, 1);

				if ($char === "(") {
					$currentExpressionDepth++;
				} else if ($char === ")") {
					$currentExpressionDepth--;
				} else if ($currentExpressionDepth < $minExpressionDepth) {
					$minExpressionDepth = $currentExpressionDepth;
				}
				
				// Set value after first iteration
				if ($minExpressionDepth === -1) $minExpressionDepth = $currentExpressionDepth;	
			}
		}
		
		return $minExpressionDepth;
	}
	
	/*
	 * Performs a logical OR operation on the elements in this array. Returns true
	 * if at least one of the elements is true.
	 * Parameters:
	 *		array - array, of which the elements should be booleans.
	 */
	function performLogicOR ($array) {
		foreach ($array as $element) {
			if ($element === true) return true;
		}
		unset($element);
		
		return false;
	}
	
	/*
	 * Performs a logical AND operation on the elements in this array. Returns true
	 * if all elements are true.
	 * Parameters:
	 *		array - array, of which the elements should be booleans.
	 */
	function performLogicAND ($array) {
		foreach ($array as $element) {
			if ($element === false) return false;
		}
		unset($element);
		
		return true;
	}	
	
	/*
	 * Performs a logical negation operation on the provided element. Returns the
	 * negated element.
	 * Parameters:
	 *		value - (boolean) value that needs to be negated.
	 */	
	function performLogicNegation ($value) {
		return ($value) ? false : true;
	}
	
	/*
	 * Checks whether the specified value is a country geolocation operator (i.e. 'country' or 'ctry')
	 * Parameters:
	 *		value - value to check.
	 * Return:
	 *		True (boolean), if the value is a country geolocation operator. Otherwise, false (boolean).
	 */	
	function isCountryGeolocationOperator ($value) {
		global $geolocationOperators;
		$ctryOperators = array();
		
		foreach ($geolocationOperators as $operator => $objectMapping) {
			if (strcasecmp($objectMapping, "COUNTRY") === 0) {
				array_push($ctryOperators, $operator);
			}
		}
		unset($operator, $objectMapping);

		return (in_arrayi($value, $ctryOperators));
	}
	
	/*
	 * Converts the specified variable into a String value.
	 * Parameters:
	 *		var - variable to be converted.
	 */
	function varToString ($var) {
		if ($var === true || $var === 1) {
			$result = "true";
		} else if ($var === false || $var === 0) {
			$result = "false";
		} else if (is_array($var)) {
			$result = "Array(";
			
			for ($i = 0; $i < count($var); $i++) {
				$result .= " [$i] => ".varToString($var[$i]);
			}
			
			$result .= " )";
		} else {
			$result = $var;
		}
		
		return $result;
	}
	
	/*
	 * Case-insensitive variant of PHP in_array().
	 * Parameters:
	 *		needle - see PHP in_array().
	 *		haystack - see PHP in_array().
	 */	
	function in_arrayi($needle, $haystack) {
	    foreach ($haystack as $value) {
	        if (strtolower($value) == strtolower($needle)) return true;
	    }
	    return false;
	}

	class GeoFilterException extends Exception {
		public function errorMessage() {
			return $this->getMessage();
		}
	}

?>