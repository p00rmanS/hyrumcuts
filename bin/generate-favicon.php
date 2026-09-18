<?php

declare(strict_types=1);

/**
 * Generates a simple geometric placeholder mark (an "H", for Hyrum) to use
 * as a favicon/app icon until a real logo/wordmark is supplied. See
 * CONTENT_CHECKLIST.md.
 */

$dir = dirname(__DIR__) . '/public/assets/images';
if (!is_dir($dir)) {
    mkdir($dir, 0775, true);
}

function drawMark(int $size): \GdImage
{
    $image = imagecreatetruecolor($size, $size);
    $ink = imagecolorallocate($image, 0x11, 0x11, 0x11);
    $copper = imagecolorallocate($image, 0xB5, 0x6B, 0x3B);
    imagefill($image, 0, 0, $ink);

    $barWidth = (int) round($size * 0.14);
    $barHeight = (int) round($size * 0.56);
    $top = (int) (($size - $barHeight) / 2);
    $leftX = (int) round($size * 0.24);
    $rightX = (int) round($size * 0.62);

    imagefilledrectangle($image, $leftX, $top, $leftX + $barWidth, $top + $barHeight, $copper);
    imagefilledrectangle($image, $rightX, $top, $rightX + $barWidth, $top + $barHeight, $copper);

    $crossHeight = (int) round($barWidth * 0.9);
    $crossY = (int) ($size / 2 - $crossHeight / 2);
    imagefilledrectangle($image, $leftX, $crossY, $rightX + $barWidth, $crossY + $crossHeight, $copper);

    return $image;
}

foreach ([512, 192, 32] as $size) {
    $image = drawMark($size);
    $suffix = $size === 512 ? '' : "-{$size}";
    imagepng($image, "{$dir}/favicon{$suffix}.png");
    imagedestroy($image);
}

echo "Favicon placeholders generated (favicon.png, favicon-192.png, favicon-32.png).\n";
