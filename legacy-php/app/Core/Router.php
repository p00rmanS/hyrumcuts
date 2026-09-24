<?php

declare(strict_types=1);

namespace App\Core;

final class Router
{
    private array $routes = [];

    public function get(string $path, array $handler): void
    {
        $this->add('GET', $path, $handler);
    }

    public function post(string $path, array $handler): void
    {
        $this->add('POST', $path, $handler);
    }

    private function add(string $method, string $path, array $handler): void
    {
        $pattern = preg_replace('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', '(?P<$1>[^/]+)', $path);
        $this->routes[] = [
            'method' => $method,
            'pattern' => '#^' . $pattern . '$#',
            'handler' => $handler,
        ];
    }

    public function dispatch(Request $request): void
    {
        $method = $request->method();
        $path = $request->path();
        $pathMatchedAnyMethod = false;

        foreach ($this->routes as $route) {
            if (!preg_match($route['pattern'], $path, $matches)) {
                continue;
            }

            if ($route['method'] !== $method) {
                $pathMatchedAnyMethod = true;
                continue;
            }

            $params = array_filter($matches, static fn ($k) => !is_int($k), ARRAY_FILTER_USE_KEY);
            $request->setRouteParams($params);

            [$class, $action] = $route['handler'];
            $controller = new $class();
            $controller->$action($request);
            return;
        }

        Response::status($pathMatchedAnyMethod ? 405 : 404);
        echo View::render($pathMatchedAnyMethod ? 'errors/405' : 'errors/404');
    }
}
