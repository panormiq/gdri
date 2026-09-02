<?php
require_once '../../../config/config.php';
require_once '../../../auth/session.php';
require_once '../../../includes/functions.php';

if (!isLoggedIn()) {
    redirect(url('auth/login-process.php'));
}

redirect(url('pages/modules/doc-template-v3/index.php'));
exit;
