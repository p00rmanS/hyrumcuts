<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Auth;
use App\Core\Controller;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Core\Validator;
use App\Repositories\AuditLogRepository;
use App\Repositories\ReviewRepository;

final class ReviewController extends Controller
{
    private const RULES = [
        'client_label' => 'required|max:60',
        'quote' => 'required|max:1000',
        'haircut_type' => 'nullable|max:80',
    ];

    public function index(Request $request): void
    {
        $this->requireAdmin();
        $this->render('admin.reviews.index', [
            'pageTitle' => 'Reviews',
            'reviews' => (new ReviewRepository())->all(),
        ], 'layouts/admin');
    }

    public function store(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $validator = Validator::make($request->all(), self::RULES);
        if ($validator->fails()) {
            $this->withErrors($validator->errors(), $request->all());
            Response::redirect('/admin/reviews');
            return;
        }

        $data = $validator->validated();
        $data['haircut_type'] = $data['haircut_type'] ?? '';
        $data['is_approved'] = (bool) $request->input('is_approved');

        $id = (new ReviewRepository())->create($data);
        (new AuditLogRepository())->log(Auth::id(), 'review.created', 'review', $id);

        Session::flash('notice', 'Review added.');
        Response::redirect('/admin/reviews');
    }

    public function update(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $id = (int) $request->param('id');
        $repo = new ReviewRepository();
        if ($repo->find($id) === null) {
            Response::status(404);
            echo \App\Core\View::render('errors/404', [], 'layouts/admin');
            return;
        }

        $validator = Validator::make($request->all(), self::RULES);
        if ($validator->fails()) {
            $this->withErrors($validator->errors(), $request->all());
            Response::redirect('/admin/reviews');
            return;
        }

        $data = $validator->validated();
        $data['haircut_type'] = $data['haircut_type'] ?? '';
        $data['is_approved'] = (bool) $request->input('is_approved');

        $repo->update($id, $data);
        (new AuditLogRepository())->log(Auth::id(), 'review.updated', 'review', $id);

        Session::flash('notice', 'Review updated.');
        Response::redirect('/admin/reviews');
    }

    public function destroy(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $id = (int) $request->param('id');
        (new ReviewRepository())->delete($id);
        (new AuditLogRepository())->log(Auth::id(), 'review.deleted', 'review', $id);

        Session::flash('notice', 'Review removed.');
        Response::redirect('/admin/reviews');
    }
}
