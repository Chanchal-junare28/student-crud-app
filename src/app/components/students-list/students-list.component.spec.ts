import {
  TestBed,
  fakeAsync,
  flushMicrotasks,
} from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import {
  MatDialog,
  MatDialogRef,
  MatDialogConfig,
} from '@angular/material/dialog';

import { StudentService } from '../../services/student.service';
import { Student, PagedResult } from '../../models/student.model';
import { AddStudentComponent } from '../add-student/add-student.component';
import { StudentsListComponent } from '../students-list/students-list.component';

import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('StudentsListComponent (standalone)', () => {
  let component: StudentsListComponent;
  let fixture: any;

  let studentServiceMock: jasmine.SpyObj<StudentService>;
  let matDialogMock: jasmine.SpyObj<MatDialog>;

  const pagedOk: PagedResult<Student> = {
    items: [
      { id: 1, name: 'Alice', email: 'alice@example.com', gender: 'Female' },
      { id: 2, name: 'Bob', email: 'bob@example.com', gender: 'Male' },
    ],
    totalCount: 2,
    page: 1,
    pageSize: 10,
  };

  /** ✅ SAFE dialog mock helper */
  function mockDialog(result: any) {
    matDialogMock.open.and.returnValue({
      afterClosed: () => of(result),
    } as MatDialogRef<any>);
  }

  beforeEach(async () => {
    studentServiceMock = jasmine.createSpyObj<StudentService>(
      'StudentService',
      ['getAllPaged', 'findByNamePaged', 'delete']
    );

    studentServiceMock.getAllPaged.and.returnValue(of(pagedOk));
    studentServiceMock.findByNamePaged.and.returnValue(
      of({
        items: [
          { id: 3, name: 'Cara', email: 'cara@example.com', gender: 'Female' },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 10,
      })
    );
    studentServiceMock.delete.and.returnValue(of({ success: true }));

    matDialogMock = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    mockDialog(true); // default behavior

    await TestBed.configureTestingModule({
      imports: [
        StudentsListComponent,

        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,

        NoopAnimationsModule,
      ],
      providers: [
        { provide: StudentService, useValue: studentServiceMock },
        { provide: MatDialog, useValue: matDialogMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(StudentsListComponent);
    component = fixture.componentInstance;

    component['paginator'] = {
      firstPage: jasmine.createSpy('firstPage'),
    } as any;

    component['sort'] = {} as any;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('retrieveStudents should handle error', fakeAsync(() => {
    studentServiceMock.getAllPaged.and.returnValue(
      throwError(() => new Error('server down'))
    );

    component.retrieveStudents();
    flushMicrotasks();

    expect(component.message).toBe(
      'Failed to load students. Please try again.'
    );
    expect(component.loading).toBeFalse();
    expect(component.students.length).toBe(0);
    expect(component.dataSource.data.length).toBe(0);
  }));

  it('refreshList should reset state', () => {
    const applySpy = spyOn(component, 'applyLocalFilter').and.callThrough();

    component.currentStudent = { id: 1 };
    component.currentIndex = 3;
    component.message = 'Error';
    component.name = 'Bob';

    component.refreshList();

    expect(component.currentStudent).toEqual({});
    expect(component.currentIndex).toBe(-1);
    expect(component.message).toBe('');
    expect(component.name).toBe('');
    expect(applySpy).toHaveBeenCalledWith('');
  });

  it('setActiveStudent should update selection', () => {
    const s: Student = {
      id: 7,
      name: 'Sel',
      email: 'sel@example.com',
      gender: 'Other',
    };

    component.setActiveStudent(s, 2);

    expect(component.currentStudent).toEqual(s);
    expect(component.currentIndex).toBe(2);
    expect(component.message).toBe('');
  });

  it('searchName with empty input should fallback', () => {
    const spy = spyOn(component, 'retrieveStudents').and.callThrough();
    component.name = '   ';
    component.searchName();
    expect(spy).toHaveBeenCalled();
  });

  it('searchName should return results', () => {
    component.name = 'Cara';
    component.searchName();

    expect(studentServiceMock.findByNamePaged).toHaveBeenCalledWith('Cara');
    expect(component.students.length).toBe(1);
    expect(component.loading).toBeFalse();
  });

  it('searchName should handle empty result', () => {
    studentServiceMock.findByNamePaged.and.returnValue(
      of({ items: [], totalCount: 0, page: 1, pageSize: 10 })
    );

    component.name = 'None';
    component.searchName();

    expect(component.message).toBe('No students found for "None".');
  });

  it('searchName should handle error', fakeAsync(() => {
    studentServiceMock.findByNamePaged.and.returnValue(
      throwError(() => new Error('boom'))
    );

    component.name = 'Fail';
    component.searchName();
    flushMicrotasks();

    expect(component.message).toBe('Search failed. Please try again.');
    expect(component.loading).toBeFalse();
  }));

  it('applyLocalFilter should normalize and reset paginator', () => {
    component.applyLocalFilter('  BoB ');
    expect(component.dataSource.filter).toBe('bob');
    expect(component['paginator'].firstPage).toHaveBeenCalled();
  });

  it('onPage should update page and size', () => {
    component.onPage({ pageIndex: 1, pageSize: 25 } as any);
    expect(component.page).toBe(2);
    expect(component.pageSize).toBe(25);
  });

  it('editStudent should refresh on truthy dialog result', () => {
    mockDialog(true);
    const spy = spyOn(component, 'retrieveStudents').and.callThrough();

    component.editStudent({ id: 5, name: 'Edit' });

    expect(spy).toHaveBeenCalled();
  });

  it('editStudent should NOT refresh on falsy dialog result', () => {
    mockDialog(false);
    const spy = spyOn(component, 'retrieveStudents');

    component.editStudent({ id: 6, name: 'NoEdit' });

    expect(spy).not.toHaveBeenCalled();
  });

  it('deleteStudent should not call service without id', () => {
    component.deleteStudent({ name: 'NoId' });
    expect(studentServiceMock.delete).not.toHaveBeenCalled();
  });

  it('deleteStudent should delete and refresh', () => {
    const spy = spyOn(component, 'retrieveStudents').and.callThrough();

    component.deleteStudent({ id: 99 });

    expect(studentServiceMock.delete).toHaveBeenCalledWith(99);
    expect(spy).toHaveBeenCalled();
  });

  it('openAddDialog should refresh on truthy dialog result', () => {
    mockDialog(true);
    const spy = spyOn(component, 'retrieveStudents').and.callThrough();

    component.openAddDialog();

    expect(spy).toHaveBeenCalled();
  });

  it('openAddDialog should NOT refresh on falsy dialog result', () => {
    mockDialog(null);
    const spy = spyOn(component, 'retrieveStudents');

    component.openAddDialog();

    expect(spy).not.toHaveBeenCalled();
  });
});