<?php
header("Content-Type: application/json; charset=utf-8");

$root = realpath(__DIR__ . "/../workflows");
if (!$root) {
  http_response_code(500);
  echo json_encode(["error" => "workflow_root_not_found"]);
  exit;
}

function respond($data, $status = 200) {
  http_response_code($status);
  echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

function sanitize_path($path) {
  $path = str_replace("\\", "/", $path ?? "");
  $path = preg_replace("/\0+/", "", $path);
  $path = ltrim($path, "/");
  $path = preg_replace("/^\.\//", "", $path);
  if (strpos($path, "../") !== false) {
    return null;
  }
  if (!preg_match("/^[a-zA-Z0-9_\\-\\/\\.]+$/", $path)) {
    return null;
  }
  return $path;
}

function read_json($file) {
  $raw = @file_get_contents($file);
  if ($raw === false) {
    return null;
  }
  $data = json_decode($raw, true);
  return is_array($data) ? $data : null;
}

function build_index_entries($root) {
  $entries = [];
  $files = glob($root . "/*.json") ?: [];
  foreach ($files as $file) {
    if (basename($file) === "index.json") {
      continue;
    }
    $filename = basename($file, ".json");
    $meta = read_json($file);
    $displayName = $filename;
    if (is_array($meta)) {
      $displayName = $meta["name"] ?? $meta["title"] ?? $filename;
    }
    $entries[] = [
      "id" => $filename,
      "name" => $displayName,
      "file" => "workflows/" . basename($file)
    ];
  }
  return $entries;
}

function write_index($root) {
  $indexFile = $root . "/index.json";
  $payload = ["workflows" => build_index_entries($root)];
  $encoded = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  return @file_put_contents($indexFile, $encoded) !== false;
}

$action = $_GET["action"] ?? "list";

if ($action === "list") {
  $entries = build_index_entries($root);
  respond(["workflows" => $entries]);
}

if ($action === "read") {
  $path = sanitize_path($_GET["path"] ?? "");
  if (!$path) {
    respond(["error" => "invalid_path"], 400);
  }
  if (strpos($path, "workflows/") === 0) {
    $path = substr($path, strlen("workflows/"));
  }
  $full = $root . "/" . $path;
  if (!file_exists($full)) {
    respond(["error" => "not_found"], 404);
  }
  $data = read_json($full);
  if (!$data) {
    respond(["error" => "invalid_json"], 422);
  }
  respond($data);
}

if ($action === "save") {
  $body = json_decode(file_get_contents("php://input"), true);
  if (!is_array($body)) {
    respond(["error" => "invalid_body"], 400);
  }
  $payload = $body["data"] ?? null;
  if (!is_array($payload)) {
    respond(["error" => "missing_data"], 400);
  }
  $path = sanitize_path($body["path"] ?? "");
  if ($path && strpos($path, "workflows/") === 0) {
    $path = substr($path, strlen("workflows/"));
  }
  $filename = $body["filename"] ?? $body["file"] ?? "";
  $filename = sanitize_path($filename);
  $targetFile = $path ?: $filename;
  if (!$targetFile) {
    respond(["error" => "missing_filename"], 400);
  }
  if (substr($targetFile, -5) !== ".json") {
    $targetFile .= ".json";
  }
  $dest = $root . "/" . $targetFile;
  $encoded = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  if (@file_put_contents($dest, $encoded) === false) {
    respond(["error" => "write_failed"], 500);
  }
  write_index($root);
  respond(["ok" => true, "path" => "workflows/" . basename($targetFile)]);
}

if ($action === "delete") {
  $path = sanitize_path($_GET["path"] ?? "");
  if (!$path) {
    respond(["error" => "invalid_path"], 400);
  }
  if (strpos($path, "workflows/") === 0) {
    $path = substr($path, strlen("workflows/"));
  }
  $full = $root . "/" . $path;
  if (!file_exists($full)) {
    respond(["error" => "not_found"], 404);
  }
  if (!@unlink($full)) {
    respond(["error" => "delete_failed"], 500);
  }
  write_index($root);
  respond(["ok" => true]);
}

respond(["error" => "unknown_action"], 400);
