<?php
// This is a debugging file to help identify PHP configuration issues
// Place this file in your db folder alongside prof.php

// Enable full error reporting
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Set content type to plain text for better readability
header('Content-Type: text/plain');

echo "=== PHP PROBE DEBUG INFO ===\n\n";

// PHP version and server info
echo "PHP Version: " . phpversion() . "\n";
echo "Server Software: " . $_SERVER['SERVER_SOFTWARE'] . "\n";
echo "Server Name: " . $_SERVER['SERVER_NAME'] . "\n";
echo "Document Root: " . $_SERVER['DOCUMENT_ROOT'] . "\n";
echo "Script Path: " . __FILE__ . "\n\n";

// Session info
echo "=== SESSION INFO ===\n";
session_start();
echo "Session active: " . (session_status() === PHP_SESSION_ACTIVE ? "Yes" : "No") . "\n";
echo "Session ID: " . session_id() . "\n";
echo "Session Data:\n";
if (empty($_SESSION)) {
    echo "  (Empty session)\n";
} else {
    foreach ($_SESSION as $key => $value) {
        echo "  $key: " . (is_array($value) ? json_encode($value) : $value) . "\n";
    }
}
echo "\n";

// Check for config.php
echo "=== DATABASE CONFIG ===\n";
$configPath = __DIR__ . '/config.php';
echo "Looking for config.php at: $configPath\n";
echo "Config file exists: " . (file_exists($configPath) ? "Yes" : "No") . "\n\n";

// Try to include config and test database connection
echo "=== DATABASE CONNECTION TEST ===\n";
try {
    echo "Attempting to include config.php...\n";
    
    // Include config file but catch any syntax errors
    ob_start();
    $configIncluded = @include($configPath);
    $includeOutput = ob_get_clean();
    
    if ($configIncluded) {
        echo "Config file included successfully.\n";
    } else {
        echo "Failed to include config file.\n";
        echo "Include output: " . $includeOutput . "\n";
    }
    
    // Check if PDO variable exists
    if (isset($pdo)) {
        echo "PDO object exists.\n";
        // Test connection with a simple query
        try {
            $stmt = $pdo->query("SELECT 1");
            echo "Database connection is working.\n";
        } catch (PDOException $e) {
            echo "Database connection error: " . $e->getMessage() . "\n";
        }
    } else {
        echo "PDO object not found after including config.php.\n";
        // Try to dump variables from config
        echo "Visible variables after config include:\n";
        $definedVars = get_defined_vars();
        foreach ($definedVars as $key => $value) {
            if ($key !== 'GLOBALS' && $key !== '_ENV' && $key !== '_SERVER' && $key !== 'configIncluded') {
                if (is_object($value)) {
                    echo "  $key: " . get_class($value) . " Object\n";
                } elseif (is_array($value)) {
                    echo "  $key: Array with " . count($value) . " items\n";
                } else {
                    echo "  $key: " . (is_string($value) ? $value : var_export($value, true)) . "\n";
                }
            }
        }
    }
} catch (Exception $e) {
    echo "Error testing database: " . $e->getMessage() . "\n";
}

echo "\n=== COMMON DIRECTORY PATHS ===\n";
echo "Current dir: " . getcwd() . "\n";
echo "One level up: " . dirname(__DIR__) . "\n";
echo "Two levels up: " . dirname(dirname(__DIR__)) . "\n";

echo "\n=== FILE CHECK ===\n";
echo "prof.php exists: " . (file_exists(__DIR__ . '/prof.php') ? "Yes" : "No") . "\n";

echo "\n=== END OF DEBUG INFO ===\n";