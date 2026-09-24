<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Auth;
use App\Core\Controller;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Core\Uploads;
use App\Core\Validator;
use App\Repositories\AuditLogRepository;
use App\Repositories\GalleryRepository;

final class GalleryController extends Controller
{
    public function index(Request $request): void
    {
        $this->requireAdmin();

        $repo = new GalleryRepository();
        $this->render('admin.gallery.index', [
            'pageTitle' => 'Gallery',
            'items' => $repo->adminItems(),
            'categories' => $repo->categories(),
        ], 'layouts/admin');
    }

    public function create(Request $request): void
    {
        $this->requireAdmin();

        $this->render('admin.gallery.form', [
            'pageTitle' => 'Add Gallery Item',
            'categories' => (new GalleryRepository())->categories(),
            'item' => null,
        ], 'layouts/admin');
    }

    public function store(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $rules = [
            'category_id' => 'required|integer',
            'title' => 'required|max:120',
            'description' => 'nullable|max:500',
            'alt_text' => 'required|max:200',
        ];
        $validator = Validator::make($request->all(), $rules);
        $errors = $validator->errors();

        $repo = new GalleryRepository();
        if (!isset($errors['category_id']) && $repo->findCategory((int) $request->input('category_id')) === null) {
            $errors['category_id'] = 'Choose a valid category.';
        }

        $isTransformation = $request->input('is_transformation') ? true : false;
        $primary = $request->file('image');
        $before = $request->file('image_before');
        $after = $request->file('image_after');

        if (!$isTransformation && $primary === null) {
            $errors['image'] = 'Please choose an image to upload.';
        } elseif ($isTransformation && ($before === null || $after === null)) {
            $errors['image'] = 'Please choose both a before and an after image.';
        }

        if ($errors !== []) {
            $this->withErrors($errors, $request->all());
            Response::redirect('/admin/gallery/create');
            return;
        }

        $data = $validator->validated();
        $data['is_featured'] = (bool) $request->input('is_featured');
        $data['is_transformation'] = $isTransformation;
        $data['description'] = $data['description'] ?? '';

        try {
            $itemId = $repo->create($data);

            if ($isTransformation) {
                $this->storeMediaOrFail($repo, $itemId, 'before', $before);
                $this->storeMediaOrFail($repo, $itemId, 'after', $after);
            } else {
                $this->storeMediaOrFail($repo, $itemId, 'primary', $primary);
            }
        } catch (\RuntimeException $e) {
            Session::flash('admin_error', $e->getMessage());
            Response::redirect('/admin/gallery/create');
            return;
        }

        (new AuditLogRepository())->log(Auth::id(), 'gallery_item.created', 'gallery_item', $itemId);
        Session::flash('notice', 'Gallery item added.');
        Response::redirect('/admin/gallery');
    }

    private function storeMediaOrFail(GalleryRepository $repo, int $itemId, string $role, ?array $file): void
    {
        if ($file === null) {
            return;
        }
        $path = Uploads::storeImage($file, 'gallery');
        $dimensions = @getimagesize(dirname(__DIR__, 3) . '/public/' . $path);
        $repo->saveMedia($itemId, $role, $path, $dimensions[0] ?? null, $dimensions[1] ?? null);
    }

    public function edit(Request $request): void
    {
        $this->requireAdmin();

        $id = (int) $request->param('id');
        $repo = new GalleryRepository();
        $item = $repo->find($id);

        if ($item === null) {
            Response::status(404);
            echo \App\Core\View::render('errors/404', [], 'layouts/admin');
            return;
        }

        $this->render('admin.gallery.form', [
            'pageTitle' => 'Edit Gallery Item',
            'categories' => $repo->categories(),
            'item' => $item,
        ], 'layouts/admin');
    }

    public function update(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $id = (int) $request->param('id');
        $repo = new GalleryRepository();
        $item = $repo->find($id);
        if ($item === null) {
            Response::status(404);
            echo \App\Core\View::render('errors/404', [], 'layouts/admin');
            return;
        }

        $rules = [
            'category_id' => 'required|integer',
            'title' => 'required|max:120',
            'description' => 'nullable|max:500',
            'alt_text' => 'required|max:200',
        ];
        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            $this->withErrors($validator->errors(), $request->all());
            Response::redirect('/admin/gallery/' . $id . '/edit');
            return;
        }

        $data = $validator->validated();
        $data['description'] = $data['description'] ?? '';
        $data['is_featured'] = (bool) $request->input('is_featured');
        $data['is_transformation'] = (bool) $item['is_transformation'];

        $repo->update($id, $data);

        try {
            if ($data['is_transformation']) {
                $this->storeMediaOrFail($repo, $id, 'before', $request->file('image_before'));
                $this->storeMediaOrFail($repo, $id, 'after', $request->file('image_after'));
            } else {
                $this->storeMediaOrFail($repo, $id, 'primary', $request->file('image'));
            }
        } catch (\RuntimeException $e) {
            Session::flash('admin_error', $e->getMessage());
            Response::redirect('/admin/gallery/' . $id . '/edit');
            return;
        }

        (new AuditLogRepository())->log(Auth::id(), 'gallery_item.updated', 'gallery_item', $id);
        Session::flash('notice', 'Gallery item updated.');
        Response::redirect('/admin/gallery');
    }

    public function destroy(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $id = (int) $request->param('id');
        (new GalleryRepository())->delete($id);
        (new AuditLogRepository())->log(Auth::id(), 'gallery_item.deleted', 'gallery_item', $id);

        Session::flash('notice', 'Gallery item removed.');
        Response::redirect('/admin/gallery');
    }

    public function reorder(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $order = $request->input('order', []);
        if (is_array($order) && $order !== []) {
            (new GalleryRepository())->reorder(array_map('intval', $order));
        }

        Response::json(['ok' => true]);
    }

    public function storeCategory(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $validator = Validator::make($request->all(), ['name' => 'required|max:60']);
        if ($validator->fails()) {
            Session::flash('admin_error', 'Category name is required.');
            Response::redirect('/admin/gallery');
            return;
        }

        $name = $validator->validated()['name'];
        $slug = $this->slugify($name);

        $id = (new GalleryRepository())->createCategory($name, $slug);
        (new AuditLogRepository())->log(Auth::id(), 'gallery_category.created', 'gallery_category', $id);

        Session::flash('notice', 'Category added.');
        Response::redirect('/admin/gallery');
    }

    public function updateCategory(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $id = (int) $request->param('id');
        $validator = Validator::make($request->all(), ['name' => 'required|max:60']);
        if ($validator->fails()) {
            Session::flash('admin_error', 'Category name is required.');
            Response::redirect('/admin/gallery');
            return;
        }

        $name = $validator->validated()['name'];
        (new GalleryRepository())->updateCategory($id, $name, $this->slugify($name));
        (new AuditLogRepository())->log(Auth::id(), 'gallery_category.updated', 'gallery_category', $id);

        Session::flash('notice', 'Category updated.');
        Response::redirect('/admin/gallery');
    }

    public function destroyCategory(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $id = (int) $request->param('id');
        $deleted = (new GalleryRepository())->deleteCategory($id);

        if ($deleted) {
            (new AuditLogRepository())->log(Auth::id(), 'gallery_category.deleted', 'gallery_category', $id);
            Session::flash('notice', 'Category removed.');
        } else {
            Session::flash('admin_error', 'Move or delete this category\'s items first.');
        }

        Response::redirect('/admin/gallery');
    }

    private function slugify(string $name): string
    {
        $slug = strtolower(trim($name));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? $slug;
        return trim($slug, '-');
    }
}
