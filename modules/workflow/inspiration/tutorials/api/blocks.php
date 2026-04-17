<?php
header("Content-Type: application/json; charset=utf-8");

$root = realpath(__DIR__ . "/../block");
if (!$root) {
  http_response_code(500);
  echo json_encode(["error" => "block_root_not_found"]);
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

function build_entry($file, $relativePath, $categoryId) {
  $meta = read_json($file);
  $filename = pathinfo($file, PATHINFO_FILENAME);
  $id = $meta["id"] ?? $filename;
  $name = $meta["name"] ?? ($meta["tutorial"]["title"] ?? $id);
  $shape = $meta["shape"] ?? [];
  return [
    "id" => $id,
    "name" => $name,
    "path" => $relativePath,
    "category" => $categoryId,
    "shape" => [
      "type" => $shape["type"] ?? null,
      "text" => $shape["text"] ?? null,
      "imageData" => $shape["imageData"] ?? null
    ]
  ];
}

$action = $_GET["action"] ?? "list";

if ($action === "list") {
  $categories = [];

  $generalFiles = glob($root . "/*.json") ?: [];
  if (count($generalFiles)) {
    $entries = [];
    foreach ($generalFiles as $file) {
      if (basename($file) === "index.json") {
        continue;
      }
      $entries[] = build_entry($file, "block/" . basename($file), "general");
    }
    $categories[] = [
      "id" => "general",
      "name" => "General",
      "blocks" => $entries
    ];
  }

  $dirs = glob($root . "/*", GLOB_ONLYDIR) ?: [];
  sort($dirs, SORT_NATURAL | SORT_FLAG_CASE);
  foreach ($dirs as $dir) {
    $dirName = basename($dir);
    $files = glob($dir . "/*.json") ?: [];
    if (!count($files)) {
      continue;
    }
    $entries = [];
    foreach ($files as $file) {
      if (basename($file) === "index.json") {
        continue;
      }
      $entries[] = build_entry(
        $file,
        "block/" . $dirName . "/" . basename($file),
        $dirName
      );
    }
    $categories[] = [
      "id" => $dirName,
      "name" => $dirName,
      "blocks" => $entries
    ];
  }

  respond(["categories" => $categories]);
}

if ($action === "read") {
  $path = sanitize_path($_GET["path"] ?? "");
  if (!$path) {
    respond(["error" => "invalid_path"], 400);
  }
  if (strpos($path, "block/") === 0) {
    $path = substr($path, strlen("block/"));
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
  if ($path && strpos($path, "block/") === 0) {
    $path = substr($path, strlen("block/"));
  }
  $category = sanitize_path($body["category"] ?? "");
  $filename = $body["filename"] ?? $body["file"] ?? "";
  $filename = sanitize_path($filename);
  if ($path) {
    $targetDir = dirname($path);
    $targetFile = basename($path);
  } else {
    $targetDir = $category ?: "";
    $targetFile = $filename ?: "";
  }
  if (!$targetFile) {
    respond(["error" => "missing_filename"], 400);
  }
  if (substr($targetFile, -5) !== ".json") {
    $targetFile .= ".json";
  }
  $destDir = rtrim($root . "/" . $targetDir, "/");
  if (!is_dir($destDir)) {
    if (!mkdir($destDir, 0755, true)) {
      respond(["error" => "mkdir_failed"], 500);
    }
  }
  $realDir = realpath($destDir);
  if (!$realDir || strpos($realDir, $root) !== 0) {
    respond(["error" => "invalid_destination"], 400);
  }
  $dest = $realDir . "/" . $targetFile;
  $encoded = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  if (@file_put_contents($dest, $encoded) === false) {
    respond(["error" => "write_failed"], 500);
  }
  $relative = "block/" . ltrim(($targetDir ? $targetDir . "/" : "") . $targetFile, "/");
  respond(["ok" => true, "path" => $relative]);
}

if ($action === "delete") {
  $path = sanitize_path($_GET["path"] ?? "");
  if (!$path) {
    respond(["error" => "invalid_path"], 400);
  }
  if (strpos($path, "block/") === 0) {
    $path = substr($path, strlen("block/"));
  }
  $full = $root . "/" . $path;
  if (!file_exists($full)) {
    respond(["error" => "not_found"], 404);
  }
  if (@unlink($full) === false) {
    respond(["error" => "delete_failed"], 500);
  }
  respond(["ok" => true]);
}

respond(["error" => "unknown_action"], 400);
