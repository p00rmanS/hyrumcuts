<?php

declare(strict_types=1);

namespace App\Core;

final class View
{
    private static string $layout = 'layouts/site';
    private static array $shared = [];

    public static function share(array $data): void
    {
        self::$shared = array_merge(self::$shared, $data);
    }

    public static function render(string $view, array $data = [], ?string $layout = 'layouts/site'): string
    {
        $data = array_merge(self::$shared, $data);
        $content = self::renderFile($view, $data);

        if ($layout === null) {
            return $content;
        }

        return self::renderFile($layout, array_merge($data, ['content' => $content]));
    }

    private static function renderFile(string $view, array $data): string
    {
        $path = BASE_PATH . '/app/Views/' . str_replace('.', '/', $view) . '.php';
        if (!is_file($path)) {
            throw new \RuntimeException("View not found: {$view}");
        }

        extract($data, EXTR_SKIP);
        ob_start();
        require $path;
        return (string) ob_get_clean();
    }

    public static function partial(string $view, array $data = []): string
    {
        return self::renderFile($view, array_merge(self::$shared, $data));
    }
}
