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
use App\Repositories\ServiceRepository;

final class ServiceController extends Controller
{
    private const RULES = [
        'name' => 'required|max:100',
        'description' => 'nullable|max:300',
    ];

    public function index(Request $request): void
    {
        $this->requireAdmin();
        $this->render('admin.services.index', [
            'pageTitle' => 'Services',
            'services' => (new ServiceRepository())->all(),
        ], 'layouts/admin');
    }

    public function store(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $validator = Validator::make($request->all(), self::RULES);
        if ($validator->fails()) {
            $this->withErrors($validator->errors(), $request->all());
            Response::redirect('/admin/services');
            return;
        }

        $data = $validator->validated();
        $data['description'] = $data['description'] ?? '';
        $data['is_active'] = (bool) $request->input('is_active', true);

        $id = (new ServiceRepository())->create($data);
        (new AuditLogRepository())->log(Auth::id(), 'service.created', 'service', $id);

        Session::flash('notice', 'Service added.');
        Response::redirect('/admin/services');
    }

    public function update(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $id = (int) $request->param('id');
        $repo = new ServiceRepository();
        if ($repo->find($id) === null) {
            Response::status(404);
            echo \App\Core\View::render('errors/404', [], 'layouts/admin');
            return;
        }

        $validator = Validator::make($request->all(), self::RULES);
        if ($validator->fails()) {
            $this->withErrors($validator->errors(), $request->all());
            Response::redirect('/admin/services');
            return;
        }

        $data = $validator->validated();
        $data['description'] = $data['description'] ?? '';
        $data['is_active'] = (bool) $request->input('is_active');

        $repo->update($id, $data);
        (new AuditLogRepository())->log(Auth::id(), 'service.updated', 'service', $id);

        Session::flash('notice', 'Service updated.');
        Response::redirect('/admin/services');
    }

    public function destroy(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $id = (int) $request->param('id');
        (new ServiceRepository())->delete($id);
        (new AuditLogRepository())->log(Auth::id(), 'service.deleted', 'service', $id);

        Session::flash('notice', 'Service removed.');
        Response::redirect('/admin/services');
    }
}
