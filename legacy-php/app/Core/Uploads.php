<?php

declare(strict_types=1);

namespace App\Core;

final class Uploads
{
    private const ALLOWED_MIME_TO_EXT = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    private const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

    /**
     * Validate and store an uploaded image outside of any executable path.
     * Returns the generated relative path (under public/uploads/...) or
     * throws \RuntimeException with a user-safe message on failure.
     */
    public static function storeImage(array $file, string $subdirectory): string
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new \RuntimeException('The upload failed. Please try a different file.');
        }

        if (($file['size'] ?? 0) > self::MAX_BYTES) {
            throw new \RuntimeException('Images must be smaller than 8 MB.');
        }

        $tmpPath = $file['tmp_name'];
        if (!is_uploaded_file($tmpPath)) {
            throw new \RuntimeException('Invalid upload.');
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($tmpPath) ?: '';

        if (!isset(self::ALLOWED_MIME_TO_EXT[$mime])) {
            throw new \RuntimeException('Only JPG, PNG, or WebP images are allowed.');
        }

        $dimensions = @getimagesize($tmpPath);
        if ($dimensions === false) {
            throw new \RuntimeException('The file does not appear to be a valid image.');
        }
        [$width, $height] = $dimensions;
        if ($width < 200 || $height < 200) {
            throw new \RuntimeException('Images must be at least 200x200 pixels.');
        }
        if ($width > 8000 || $height > 8000) {
            throw new \RuntimeException('Image dimensions are too large.');
        }

        $ext = self::ALLOWED_MIME_TO_EXT[$mime];
        $filename = bin2hex(random_bytes(16)) . '.' . $ext;

        $subdirectory = trim($subdirectory, '/');
        $destinationDir = BASE_PATH . '/public/uploads/' . $subdirectory;
        if (!is_dir($destinationDir)) {
            mkdir($destinationDir, 0775, true);
        }

        $destination = $destinationDir . '/' . $filename;
        if (!move_uploaded_file($tmpPath, $destination)) {
            throw new \RuntimeException('Could not save the uploaded file.');
        }
        chmod($destination, 0644);

        return 'uploads/' . $subdirectory . '/' . $filename;
    }
}
