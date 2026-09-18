<?php

declare(strict_types=1);

namespace App\Core;

abstract class Controller
{
    protected function render(string $view, array $data = [], ?string $layout = 'layouts/site'): void
    {
        echo View::render($view, $data, $layout);
        // Old input / validation errors are only meant to survive a single
        // redirect-then-render (the post/redirect/get pattern used by every
        // form in this project), so clear them once a view has consumed them.
        Session::forget('_old_input');
        Session::forget('_errors');
    }

    protected function withErrors(array $errors, array $input): void
    {
        Session::put('_errors', $errors);
        Session::put('_old_input', $input);
    }

    protected function requireAdmin(): void
    {
        if (!Auth::check()) {
            Session::flash('notice', 'Please log in to continue.');
            Response::redirect('/admin/login');
        }
    }

    protected function verifyCsrfOrFail(Request $request): void
    {
        if (!Csrf::verify($request->input('_csrf'))) {
            Response::status(419);
            echo View::render('errors/419');
            exit;
        }
    }
}
