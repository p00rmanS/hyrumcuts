<?php

declare(strict_types=1);

/**
 * Generates elegant, obviously-a-placeholder JPEGs for development seed
 * data. Deliberately not photorealistic and not "AI generated fake client"
 * imagery — solid brand-color panels with a clear label — per the build
 * spec's instruction to use neutral local placeholders until real photos
 * and video are supplied. Lives outside the App\Core namespace's autoload
 * concerns (required directly by bin/seed.php) since it is a build-time
 * tool, not application runtime code.
 */
final class PlaceholderImage
{
    private const PALETTE = [
        'fades' => [0x11, 0x11, 0x11],
        'tapers' => [0x2A, 0x26, 0x22],
        'textured' => [0x3A, 0x33, 0x2B],
        'long-hair' => [0x24, 0x22, 0x1F],
        'beards' => [0x1D, 0x1A, 0x17],
        'before' => [0x3A, 0x33, 0x2B],
        'after' => [0x11, 0x11, 0x11],
        'hero' => [0x11, 0x11, 0x11],
        'og' => [0x11, 0x11, 0x11],
        'about' => [0x2A, 0x26, 0x22],
    ];

    private const COPPER = [0xB5, 0x6B, 0x3B];
    private const IVORY = [0xF4, 0xF0, 0xE8];

    public static function generate(string $folder, string $name, int $width, int $height, string $label, string $variant): string
    {
        // GD's built-in bitmap fonts only render Latin-1 (single-byte), so
        // UTF-8 punctuation like em dashes must be swapped for ASCII first
        // or it prints as mojibake.
        $label = self::toAscii($label);
        $relativeDir = 'assets/images/' . trim($folder, '/');
        $absoluteDir = BASE_PATH . '/public/' . $relativeDir;
        if (!is_dir($absoluteDir)) {
            mkdir($absoluteDir, 0775, true);
        }

        $image = imagecreatetruecolor($width, $height);

        [$r, $g, $b] = self::PALETTE[$variant] ?? [0x11, 0x11, 0x11];
        $bg = imagecolorallocate($image, $r, $g, $b);
        imagefill($image, 0, 0, $bg);

        // Restrained diagonal texture so panels don't look like flat error tiles.
        $lineColor = imagecolorallocatealpha($image, self::IVORY[0], self::IVORY[1], self::IVORY[2], 122);
        for ($x = -$height; $x < $width; $x += 28) {
            imageline($image, $x, $height, $x + $height, 0, $lineColor);
        }

        // Hairline copper frame, echoing the site's restrained-accent rule.
        $copper = imagecolorallocate($image, self::COPPER[0], self::COPPER[1], self::COPPER[2]);
        $margin = (int) round(min($width, $height) * 0.035);
        imagerectangle($image, $margin, $margin, $width - 1 - $margin, $height - 1 - $margin, $copper);

        $ivory = imagecolorallocate($image, self::IVORY[0], self::IVORY[1], self::IVORY[2]);

        $badge = 'PLACEHOLDER';
        $badgeFont = 4;
        $badgeWidth = imagefontwidth($badgeFont) * strlen($badge);
        imagestring($image, $badgeFont, (int) (($width - $badgeWidth) / 2), (int) ($height * 0.42), $badge, $copper);

        $labelLines = self::wrap($label, 26);
        $font = 5;
        $lineHeight = imagefontheight($font) + 6;
        $startY = (int) ($height * 0.42) + 26;
        foreach ($labelLines as $i => $line) {
            $lineWidth = imagefontwidth($font) * strlen($line);
            imagestring($image, $font, (int) (($width - $lineWidth) / 2), $startY + $i * $lineHeight, $line, $ivory);
        }

        $dims = "{$width} x {$height}";
        imagestring($image, 2, 10, $height - 20, $dims, $ivory);

        $path = $absoluteDir . '/' . $name . '.jpg';
        imagejpeg($image, $path, 82);
        imagedestroy($image);

        return $relativeDir . '/' . $name . '.jpg';
    }

    private static function toAscii(string $text): string
    {
        $replacements = [
            "\xE2\x80\x94" => '-', // em dash
            "\xE2\x80\x93" => '-', // en dash
            "\xE2\x80\x98" => "'", "\xE2\x80\x99" => "'",
            "\xE2\x80\x9C" => '"', "\xE2\x80\x9D" => '"',
            "\xC3\x97" => 'x', // multiplication sign
        ];
        $text = strtr($text, $replacements);
        return preg_replace('/[^\x20-\x7E]/', '', $text) ?? $text;
    }

    /** @return string[] */
    private static function wrap(string $text, int $maxChars): array
    {
        $words = explode(' ', $text);
        $lines = [];
        $current = '';
        foreach ($words as $word) {
            $candidate = $current === '' ? $word : $current . ' ' . $word;
            if (strlen($candidate) > $maxChars && $current !== '') {
                $lines[] = $current;
                $current = $word;
            } else {
                $current = $candidate;
            }
        }
        if ($current !== '') {
            $lines[] = $current;
        }
        return $lines;
    }
}
