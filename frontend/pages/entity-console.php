<?php
/**
 * Alias — redirige vers Console entité > Applications.
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';

redirect(url('pages/entity-applications.php'));
