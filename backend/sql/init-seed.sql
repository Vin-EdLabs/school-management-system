--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 18.0

-- Started on 2025-12-14 23:31:48

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5607 (class 0 OID 109468)
-- Dependencies: 245
-- Data for Name: academic_terms; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5605 (class 0 OID 109456)
-- Dependencies: 243
-- Data for Name: academic_years; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.classes (id, meta, created_at, max_class_size, level, stream) VALUES (1, '{}', '2025-12-07 08:01:06.906025-08', 30, 'KG1', 'A');
INSERT INTO public.classes (id, meta, created_at, max_class_size, level, stream) VALUES (2, '{}', '2025-12-07 21:50:52.488455-08', 30, 'KG2', 'A');
INSERT INTO public.classes (id, meta, created_at, max_class_size, level, stream) VALUES (3, '{}', '2025-12-08 23:45:33.642779-08', 30, 'Primary 1', 'A');



-- INSERT INTO public.users (id, username, password_hash, role, created_at, meta, updated_at, email, display_name, password_changed) VALUES (1, 'littleWolf', '$2b$10$TmE79G2svm2/t97GgZDw6epr.sxkU5aXg6wnsplE90B9HRPYydQqC', 'super-admin', '2025-12-07 07:40:22.381118-08', '{"email": "", "fullName": "littleWolf"}', '2025-12-07 07:40:22.381118-08', NULL, NULL, false);
INSERT INTO public.users (id, staff_id, password_hash, role, created_at, meta, updated_at, email, display_name, password_changed) VALUES (2, 'edmundamonoo408', '$2b$10$XYNqXZWpE0hOSgt4hYN6H.8cpc3XuLJJNYpsgEx4HQReTOwYaiobW', 'teacher', '2025-12-07 07:57:04.597935-08', '{"email": "edmundamonoo@gmail.com", "notes": "", "gender": "Male", "address": "545416", "fullName": "Edmund Amonoo", "dateOfBirth": "", "phoneNumber": "0557609106", "monthlySalary": 0, "employmentDate": "", "subjectsTaught": ["Art"], "employmentStatus": "Active"}', '2025-12-07 07:57:04.597935-08', NULL, NULL, false);
INSERT INTO public.users (id, staff_id, password_hash, role, created_at, meta, updated_at, email, display_name, password_changed) VALUES (3, 'patrickjammy654', '$2b$10$SswrODD0W49SldHHtdiNTOSSOZIk9lryJ45xhEiKqNDXU3NOlzitC', 'teacher', '2025-12-07 21:52:18.195322-08', '{"email": "awesome@gmail.com", "notes": "", "gender": "Male", "address": "", "fullName": "Patrick Jammy", "dateOfBirth": "", "phoneNumber": "0308484090", "monthlySalary": 0, "employmentDate": "2025-12-04", "subjectsTaught": ["Art", "Religious Studies"], "employmentStatus": "Active"}', '2025-12-07 21:52:18.195322-08', NULL, NULL, false);
INSERT INTO public.users (id, staff_id, password_hash, role, created_at, meta, updated_at, email, display_name, password_changed) VALUES (4, 'efmundamonoo635', '$2b$10$W6uokKIqbFilU1xoLkjJcueCU4imKomDvJDmfqUKMKYBCzmo3bPGC', 'teacher', '2025-12-07 22:35:31.140809-08', '{"email": "edmundamonoo@gmail.com", "notes": "", "gender": "Male", "address": "545416", "fullName": "Efmund Amonoo", "dateOfBirth": "", "phoneNumber": "0557609106", "classAssigned": "", "monthlySalary": 0, "employmentDate": "", "subjectsTaught": ["English", "Social Studies"], "employmentStatus": "Active"}', '2025-12-07 22:35:31.140809-08', NULL, NULL, false);
--
-- TOC entry 5638 (class 0 OID 111132)
-- Dependencies: 276
-- Data for Name: attendance; Type: TABLE DATA; Schema: public; Owner: postgres
--


INSERT INTO public.students (id, first_name, last_name, class_id, status, meta, created_at, admission_no, gender, date_of_birth, nationality, guardian_name, guardian_contact, home_address, previous_school, notes, date_of_admission) VALUES (5, 'Prince', 'Oponcho', 3, 'active', '{}', '2025-12-07 21:47:15.502871-08', NULL, 'Male', '2003-12-03', 'Ghanaian', 'dd', '0304893945', '545416', 'Kwame jhs', 'djd dkj kjd', '2025-12-08');
INSERT INTO public.students (id, first_name, last_name, class_id, status, meta, created_at, admission_no, gender, date_of_birth, nationality, guardian_name, guardian_contact, home_address, previous_school, notes, date_of_admission) VALUES (4, 'Becky', 'Lynch', 3, 'active', '{}', '2025-12-07 14:40:37.51387-08', NULL, 'Female', '2022-12-27', 'Ghanaian', 'Sammy Lynch', '0507898904', 'Olusegun Obasanjo Wy', 'ere', NULL, '2025-12-11');
INSERT INTO public.students (id, first_name, last_name, class_id, status, meta, created_at, admission_no, gender, date_of_birth, nationality, guardian_name, guardian_contact, home_address, previous_school, notes, date_of_admission) VALUES (1, 'Andy', 'Scott', 3, 'active', '{}', '2025-12-07 08:44:34.23417-08', NULL, 'Male', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.students (id, first_name, last_name, class_id, status, meta, created_at, admission_no, gender, date_of_birth, nationality, guardian_name, guardian_contact, home_address, previous_school, notes, date_of_admission) VALUES (3, 'Joe', 'Man', 3, 'active', '{}', '2025-12-07 14:34:25.21106-08', NULL, 'Male', '2025-12-05', 'Ghanaian', 'James Man', NULL, 'Olusegun Obasanjo Wy', 'Kwame jhs', NULL, NULL);
INSERT INTO public.students (id, first_name, last_name, class_id, status, meta, created_at, admission_no, gender, date_of_birth, nationality, guardian_name, guardian_contact, home_address, previous_school, notes, date_of_admission) VALUES (2, 'Randy', 'Amonoo', 3, 'active', '{}', '2025-12-07 13:57:18.740456-08', '3', 'Male', '2025-12-03', 'Ghanaian', 'Frank Amonoo', '0507898904', '545416', 'Kwame jhs', '', NULL);


INSERT INTO public.attendance (id, class_id, student_id, attendance_date, status, marked_by, notes, created_at, updated_at) VALUES (1, 3, 5, '2025-12-11', 'present', 4, NULL, '2025-12-10 16:52:50.351608-08', '2025-12-10 16:59:00.716844-08');
INSERT INTO public.attendance (id, class_id, student_id, attendance_date, status, marked_by, notes, created_at, updated_at) VALUES (2, 3, 4, '2025-12-11', 'absent', 4, NULL, '2025-12-10 16:52:50.351608-08', '2025-12-10 16:59:00.716844-08');
INSERT INTO public.attendance (id, class_id, student_id, attendance_date, status, marked_by, notes, created_at, updated_at) VALUES (3, 3, 3, '2025-12-11', 'present', 4, NULL, '2025-12-10 16:52:50.351608-08', '2025-12-10 16:59:00.716844-08');
INSERT INTO public.attendance (id, class_id, student_id, attendance_date, status, marked_by, notes, created_at, updated_at) VALUES (4, 3, 2, '2025-12-11', 'present', 4, NULL, '2025-12-10 16:52:50.351608-08', '2025-12-10 16:59:00.716844-08');
INSERT INTO public.attendance (id, class_id, student_id, attendance_date, status, marked_by, notes, created_at, updated_at) VALUES (5, 3, 1, '2025-12-11', 'absent', 4, NULL, '2025-12-10 16:52:50.351608-08', '2025-12-10 16:59:00.716844-08');
INSERT INTO public.attendance (id, class_id, student_id, attendance_date, status, marked_by, notes, created_at, updated_at) VALUES (11, 3, 5, '2025-12-12', 'present', 4, NULL, '2025-12-10 16:59:20.573818-08', '2025-12-10 16:59:20.573818-08');
INSERT INTO public.attendance (id, class_id, student_id, attendance_date, status, marked_by, notes, created_at, updated_at) VALUES (12, 3, 4, '2025-12-12', 'absent', 4, NULL, '2025-12-10 16:59:20.573818-08', '2025-12-10 16:59:20.573818-08');
INSERT INTO public.attendance (id, class_id, student_id, attendance_date, status, marked_by, notes, created_at, updated_at) VALUES (13, 3, 3, '2025-12-12', 'present', 4, NULL, '2025-12-10 16:59:20.573818-08', '2025-12-10 16:59:20.573818-08');
INSERT INTO public.attendance (id, class_id, student_id, attendance_date, status, marked_by, notes, created_at, updated_at) VALUES (14, 3, 2, '2025-12-12', 'absent', 4, NULL, '2025-12-10 16:59:20.573818-08', '2025-12-10 16:59:20.573818-08');
INSERT INTO public.attendance (id, class_id, student_id, attendance_date, status, marked_by, notes, created_at, updated_at) VALUES (15, 3, 1, '2025-12-12', 'present', 4, NULL, '2025-12-10 16:59:20.573818-08', '2025-12-10 16:59:20.573818-08');


--
-- TOC entry 5587 (class 0 OID 109322)
-- Dependencies: 225
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (1, 1, 'login', '{"username": "littleWolf"}', '2025-12-07 07:40:40.246206-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (2, 1, 'login', '{"username": "littleWolf"}', '2025-12-07 23:35:42.005182-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (3, 1, 'login', '{"username": "littleWolf"}', '2025-12-08 00:14:03.229987-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (4, 1, 'login', '{"username": "littleWolf"}', '2025-12-08 13:03:59.375122-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (5, 1, 'login', '{"username": "littleWolf"}', '2025-12-08 13:29:28.711857-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (6, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-08 13:32:15.007109-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (7, 1, 'login', '{"username": "littleWolf"}', '2025-12-08 13:43:32.708298-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (8, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-08 13:47:17.087281-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (9, 1, 'login', '{"username": "littleWolf"}', '2025-12-08 14:02:07.526879-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (10, 1, 'login', '{"username": "littleWolf"}', '2025-12-08 14:35:15.263136-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (11, 1, 'login', '{"username": "littleWolf"}', '2025-12-08 22:40:37.627257-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (12, 1, 'login', '{"username": "littleWolf"}', '2025-12-08 22:40:52.540187-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (13, 1, 'login', '{"username": "littleWolf"}', '2025-12-08 22:41:10.821232-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (14, 1, 'login', '{"username": "littleWolf"}', '2025-12-08 22:42:33.871609-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (15, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-09 00:43:09.310191-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (16, 1, 'login', '{"username": "littleWolf"}', '2025-12-09 00:48:33.772133-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (17, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 13:56:59.290394-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (18, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 15:00:02.966114-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (19, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 15:00:41.226245-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (20, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 15:01:21.677747-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (21, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 15:02:45.923568-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (22, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 15:05:18.419338-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (23, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 15:05:28.181048-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (24, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 15:14:54.287268-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (25, 4, 'login', '{"username": "efmundamonoo635"}', '2025-12-10 15:16:06.756514-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (26, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 15:17:09.812507-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (27, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 15:18:27.274753-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (28, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 15:26:38.920002-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (29, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 15:28:30.575881-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (30, 4, 'login', '{"username": "efmundamonoo635"}', '2025-12-10 15:28:51.059755-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (31, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 15:29:29.642987-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (32, 4, 'login', '{"username": "efmundamonoo635"}', '2025-12-10 15:34:37.092439-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (33, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 15:36:16.108909-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (34, 4, 'login', '{"username": "efmundamonoo635"}', '2025-12-10 15:38:43.547736-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (35, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 15:44:51.039389-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (36, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 16:09:35.974231-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (37, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 16:12:38.957138-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (38, 4, 'login', '{"username": "efmundamonoo635"}', '2025-12-10 16:14:17.824621-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (39, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 16:17:59.567979-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (40, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 16:21:18.54485-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (41, 4, 'login', '{"username": "efmundamonoo635"}', '2025-12-10 16:24:25.497482-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (42, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 16:24:39.884535-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (43, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 16:51:21.082363-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (44, 4, 'login', '{"username": "efmundamonoo635"}', '2025-12-10 16:51:54.101952-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (45, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 17:21:54.443542-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (46, 4, 'login', '{"username": "efmundamonoo635"}', '2025-12-10 17:33:17.58646-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (47, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 17:38:01.689732-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (48, 4, 'login', '{"username": "efmundamonoo635"}', '2025-12-10 17:42:18.329315-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (49, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 17:44:23.614502-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (50, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 17:49:37.652308-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (51, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 17:58:36.087962-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (52, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 18:04:17.757777-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (53, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 18:06:41.395203-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (54, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 18:16:37.349385-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (55, 1, 'login', '{"username": "Wolf"}', '2025-12-10 18:18:28.63699-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (56, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 18:20:03.724014-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (57, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-10 19:00:48.78301-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (58, 4, 'login', '{"username": "efmundamonoo635"}', '2025-12-10 19:02:14.323424-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (59, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 19:07:49.244581-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (60, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 19:14:06.323751-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (61, 1, 'login', '{"username": "littleWolf"}', '2025-12-10 19:14:16.477619-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (62, 1, 'login', '{"username": "littleWolf"}', '2025-12-11 03:13:41.54836-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (63, 4, 'login', '{"username": "efmundamonoo635"}', '2025-12-11 04:45:49.151291-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (64, 4, 'login', '{"username": "efmundamonoo635"}', '2025-12-11 04:45:51.205597-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (65, 1, 'login', '{"username": "littleWolf"}', '2025-12-11 07:31:30.113832-08');
-- INSERT INTO public.audit_log (id, user_id, action, meta, created_at) VALUES (66, 2, 'login', '{"username": "edmundamonoo408"}', '2025-12-13 12:27:29.484196-08');


--
-- TOC entry 5603 (class 0 OID 109437)
-- Dependencies: 241
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--


INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (1, 'Mathematics (Primary)', NULL, NULL, '{"description": "Mathematics curriculum for children (primary)"}', '2025-12-11 06:13:47.92912-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (2, 'English (Primary)', NULL, NULL, '{"description": "English language for primary learners"}', '2025-12-11 06:13:47.958164-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (3, 'Science (Primary)', NULL, NULL, '{"description": "General science for primary level"}', '2025-12-11 06:13:47.962629-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (4, 'Social Studies (Primary)', NULL, NULL, '{"description": "Social studies for children"}', '2025-12-11 06:13:47.965557-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (5, 'Art (Primary)', NULL, NULL, '{"description": "Art & craft for primary learners"}', '2025-12-11 06:13:47.970396-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (6, 'Music (Primary)', NULL, NULL, '{"description": "Music lessons for children"}', '2025-12-11 06:13:47.974415-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (7, 'Physical Education (Primary)', NULL, NULL, '{"description": "Physical activities and sports"}', '2025-12-11 06:13:47.977649-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (8, 'ICT (Primary)', NULL, NULL, '{"description": "Basic computer skills for children"}', '2025-12-11 06:13:47.980709-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (9, 'Mathematics', NULL, NULL, '{"description": "Mathematics for secondary level"}', '2025-12-11 06:13:47.983125-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (10, 'English Language', NULL, NULL, '{"description": "English language and literature"}', '2025-12-11 06:13:47.986881-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (11, 'Biology', NULL, NULL, '{"description": "Biology for secondary students"}', '2025-12-11 06:13:47.990638-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (12, 'Chemistry', NULL, NULL, '{"description": "Chemistry for secondary students"}', '2025-12-11 06:13:47.995663-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (13, 'Physics', NULL, NULL, '{"description": "Physics for secondary students"}', '2025-12-11 06:13:47.998552-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (14, 'History', NULL, NULL, '{"description": "History and civics"}', '2025-12-11 06:13:48.001177-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (15, 'Geography', NULL, NULL, '{"description": "Geography and environmental studies"}', '2025-12-11 06:13:48.003933-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (16, 'Computer Science', NULL, NULL, '{"description": "Computer Science and programming"}', '2025-12-11 06:13:48.015519-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (17, 'Economics', NULL, NULL, '{"description": "Economics and commerce"}', '2025-12-11 06:13:48.021895-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (18, 'Art', NULL, NULL, '{"description": "Fine art and design"}', '2025-12-11 06:13:48.030722-08');
INSERT INTO public.subjects (id, name, class_id, teacher_id, meta, created_at) VALUES (19, 'Music', NULL, NULL, '{"description": "Music and performing arts"}', '2025-12-11 06:13:48.041796-08');



--
-- TOC entry 5585 (class 0 OID 109312)
-- Dependencies: 223
-- Data for Name: blacklisted_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5589 (class 0 OID 109337)
-- Dependencies: 227
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: postgres
--




--
-- TOC entry 5601 (class 0 OID 109422)
-- Dependencies: 239
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.events (id, title, date, "time", description, color, category, reminder, reminder_time, location, meta, created_at) VALUES (1, 'iiop', '2026-01-20 16:00:00-08', '02:06', 'iiio', 'bg-blue-500', 'Academic', true, 30, 'iio', '{}', '2025-12-10 18:05:50.587235-08');


--
-- TOC entry 5640 (class 0 OID 111166)
-- Dependencies: 278
-- Data for Name: exam_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.exam_types (id, name, weight, created_by, created_at) VALUES (1, 'ee', 0, 4, '2025-12-11 06:15:50.538097-08');
INSERT INTO public.exam_types (id, name, weight, created_by, created_at) VALUES (2, 'hkajad', 0, 4, '2025-12-11 06:16:35.412596-08');
INSERT INTO public.exam_types (id, name, weight, created_by, created_at) VALUES (3, 'nnmbn', 0, 2, '2025-12-14 12:35:54.792602-08');


--
-- TOC entry 5642 (class 0 OID 111177)
-- Dependencies: 280
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.exams (id, exam_type_id, class_id, subject_id, term, exam_date, is_locked, created_by, created_at) VALUES (1, 1, 2, 12, NULL, '2025-12-11 00:00:00-08', false, 4, '2025-12-11 06:15:50.773036-08');
INSERT INTO public.exams (id, exam_type_id, class_id, subject_id, term, exam_date, is_locked, created_by, created_at) VALUES (2, 2, 3, 5, NULL, '2025-12-11 00:00:00-08', false, 4, '2025-12-11 06:16:35.689501-08');
INSERT INTO public.exams (id, exam_type_id, class_id, subject_id, term, exam_date, is_locked, created_by, created_at) VALUES (3, 3, 1, 5, NULL, '2025-12-14 00:00:00-08', false, 2, '2025-12-14 12:35:55.911262-08');


--
-- TOC entry 5599 (class 0 OID 109410)
-- Dependencies: 237
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5612 (class 0 OID 109514)
-- Dependencies: 250
-- Data for Name: fee_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5593 (class 0 OID 109368)
-- Dependencies: 231
-- Data for Name: fee_structures; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5646 (class 0 OID 111226)
-- Dependencies: 284
-- Data for Name: grade_audit; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5648 (class 0 OID 111241)
-- Dependencies: 286
-- Data for Name: grade_boundaries; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.grade_boundaries (id, grade, min, max, school_id, class_id, created_by, created_at, updated_at) VALUES (1, 'A', 80, 100, NULL, NULL, NULL, '2025-12-11 06:58:22.08188-08', '2025-12-13 00:10:21.15036-08');
INSERT INTO public.grade_boundaries (id, grade, min, max, school_id, class_id, created_by, created_at, updated_at) VALUES (3, 'B', 75, 79, NULL, NULL, NULL, '2025-12-11 06:58:22.133124-08', '2025-12-13 00:10:21.834289-08');
INSERT INTO public.grade_boundaries (id, grade, min, max, school_id, class_id, created_by, created_at, updated_at) VALUES (4, 'C', 65, 74, NULL, NULL, NULL, '2025-12-11 06:58:22.142866-08', '2025-12-13 00:10:21.994841-08');
INSERT INTO public.grade_boundaries (id, grade, min, max, school_id, class_id, created_by, created_at, updated_at) VALUES (12, 'F', 0, 44, NULL, NULL, NULL, '2025-12-11 06:58:23.129501-08', '2025-12-13 00:10:22.036803-08');
INSERT INTO public.grade_boundaries (id, grade, min, max, school_id, class_id, created_by, created_at, updated_at) VALUES (13, 'E', 45, 54, NULL, NULL, 1, '2025-12-13 00:10:22.053876-08', '2025-12-13 00:10:22.053876-08');
INSERT INTO public.grade_boundaries (id, grade, min, max, school_id, class_id, created_by, created_at, updated_at) VALUES (7, 'D', 55, 64, NULL, NULL, NULL, '2025-12-11 06:58:22.666549-08', '2025-12-13 00:10:22.07055-08');


--
-- TOC entry 5644 (class 0 OID 111203)
-- Dependencies: 282
-- Data for Name: grades; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5609 (class 0 OID 109487)
-- Dependencies: 247
-- Data for Name: guardians; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5597 (class 0 OID 109400)
-- Dependencies: 235
-- Data for Name: income; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5616 (class 0 OID 109560)
-- Dependencies: 254
-- Data for Name: invoice_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5614 (class 0 OID 109531)
-- Dependencies: 252
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5581 (class 0 OID 109292)
-- Dependencies: 219
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.migrations (id, name, run_on) VALUES (1, '/20251129073738-initialize', '2025-12-07 15:39:25.3');
INSERT INTO public.migrations (id, name, run_on) VALUES (2, '/20251129120000-add-users-meta', '2025-12-07 15:39:25.334');
INSERT INTO public.migrations (id, name, run_on) VALUES (3, '/20251130130000-create-core-tables', '2025-12-07 15:39:25.615');
INSERT INTO public.migrations (id, name, run_on) VALUES (4, '/20251205120000-add-updated-at-to-users', '2025-12-07 15:39:25.656');
INSERT INTO public.migrations (id, name, run_on) VALUES (5, '/20251205121000-add-email-displayname-to-users', '2025-12-07 15:39:25.694');
INSERT INTO public.migrations (id, name, run_on) VALUES (6, '/20251206120000-add-password-changed-flag', '2025-12-07 15:39:25.712');
INSERT INTO public.migrations (id, name, run_on) VALUES (7, '/20251206120001-create-payroll-tables', '2025-12-07 15:39:25.814');
INSERT INTO public.migrations (id, name, run_on) VALUES (8, '/20251207074614-add-max-class-size-column', '2025-12-07 15:39:25.828');
INSERT INTO public.migrations (id, name, run_on) VALUES (9, '/20251207075524-remove-class-name-column', '2025-12-07 15:39:25.844');
INSERT INTO public.migrations (id, name, run_on) VALUES (10, '/20251207120000-refactor-classes-level-stream', '2025-12-07 15:39:25.873');
INSERT INTO public.migrations (id, name, run_on) VALUES (11, '/20251207153000-add-student-columns', '2025-12-07 21:53:36.747');
INSERT INTO public.migrations (id, name, run_on) VALUES (12, '/20251208101000-add-date-of-admission', '2025-12-08 05:40:07.263');
INSERT INTO public.migrations (id, name, run_on) VALUES (13, '/20251208123000-create-teacher-classes', '2025-12-08 06:24:59.753');
INSERT INTO public.migrations (id, name, run_on) VALUES (15, '/20251208150000-create-schedules', '2025-12-11 00:37:15.176');
INSERT INTO public.migrations (id, name, run_on) VALUES (16, '/20251209120000-add-schedules-exclusion', '2025-12-11 00:40:27.16');
INSERT INTO public.migrations (id, name, run_on) VALUES (17, '/20251211120000-create-attendance', '2025-12-11 00:40:27.293');
INSERT INTO public.migrations (id, name, run_on) VALUES (18, '/20251211125000-create-subjects', '2025-12-11 03:05:51.402');
INSERT INTO public.migrations (id, name, run_on) VALUES (19, '/20251211130000-create-grades', '2025-12-11 03:05:51.649');
INSERT INTO public.migrations (id, name, run_on) VALUES (20, '/20251211160000-create-grade-boundaries', '2025-12-11 14:41:46.991');
INSERT INTO public.migrations (id, name, run_on) VALUES (21, '/20251212101500-add-updated-at-to-grade-boundaries', '2025-12-12 13:37:12.721');


--
-- TOC entry 5621 (class 0 OID 109604)
-- Dependencies: 259
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5618 (class 0 OID 109580)
-- Dependencies: 256
-- Data for Name: payment_allocations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5595 (class 0 OID 109383)
-- Dependencies: 233
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5631 (class 0 OID 109702)
-- Dependencies: 269
-- Data for Name: payroll_deductions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5627 (class 0 OID 109658)
-- Dependencies: 265
-- Data for Name: payroll_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5629 (class 0 OID 109682)
-- Dependencies: 267
-- Data for Name: payroll_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5633 (class 0 OID 109717)
-- Dependencies: 271
-- Data for Name: payroll_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5625 (class 0 OID 109645)
-- Dependencies: 263
-- Data for Name: payroll_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5636 (class 0 OID 109796)
-- Dependencies: 274
-- Data for Name: schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.schedules (id, class_id, teacher_id, day_of_week, start_time, end_time, room, subject, created_at, updated_at) VALUES (1, 1, 2, 1, '09:00:00', '10:00:00', 'A101', 'Art', '2025-12-10 17:48:23.223597', '2025-12-10 17:48:23.223597');
INSERT INTO public.schedules (id, class_id, teacher_id, day_of_week, start_time, end_time, room, subject, created_at, updated_at) VALUES (2, 1, 2, 1, '10:00:00', '11:00:00', 'A101', 'Art', '2025-12-10 17:48:23.223597', '2025-12-10 17:48:23.223597');
INSERT INTO public.schedules (id, class_id, teacher_id, day_of_week, start_time, end_time, room, subject, created_at, updated_at) VALUES (3, 1, 2, 2, '09:00:00', '10:00:00', 'A101', 'Art', '2025-12-10 17:48:23.223597', '2025-12-10 17:48:23.223597');


--
-- TOC entry 5619 (class 0 OID 109596)
-- Dependencies: 257
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5610 (class 0 OID 109497)
-- Dependencies: 248
-- Data for Name: student_guardians; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5591 (class 0 OID 109352)
-- Dependencies: 229
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: postgres
--


--
-- TOC entry 5623 (class 0 OID 109622)
-- Dependencies: 261
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- TOC entry 5634 (class 0 OID 109758)
-- Dependencies: 272
-- Data for Name: teacher_classes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.teacher_classes (teacher_id, class_id) VALUES (2, 1);
INSERT INTO public.teacher_classes (teacher_id, class_id) VALUES (4, 3);
INSERT INTO public.teacher_classes (teacher_id, class_id) VALUES (3, 2);


--
-- TOC entry 5583 (class 0 OID 109299)
-- Dependencies: 221
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5688 (class 0 OID 0)
-- Dependencies: 244
-- Name: academic_terms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.academic_terms_id_seq', 1, false);


--
-- TOC entry 5689 (class 0 OID 0)
-- Dependencies: 242
-- Name: academic_years_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.academic_years_id_seq', 1, false);


--
-- TOC entry 5690 (class 0 OID 0)
-- Dependencies: 275
-- Name: attendance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.attendance_id_seq', 15, true);


--
-- TOC entry 5691 (class 0 OID 0)
-- Dependencies: 224
-- Name: audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_log_id_seq', 66, true);


--
-- TOC entry 5692 (class 0 OID 0)
-- Dependencies: 240
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 1, false);


--
-- TOC entry 5693 (class 0 OID 0)
-- Dependencies: 222
-- Name: blacklisted_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.blacklisted_tokens_id_seq', 1, false);


--
-- TOC entry 5694 (class 0 OID 0)
-- Dependencies: 226
-- Name: classes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.classes_id_seq', 3, true);


--
-- TOC entry 5695 (class 0 OID 0)
-- Dependencies: 238
-- Name: events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.events_id_seq', 1, true);


--
-- TOC entry 5696 (class 0 OID 0)
-- Dependencies: 277
-- Name: exam_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exam_types_id_seq', 3, true);


--
-- TOC entry 5697 (class 0 OID 0)
-- Dependencies: 279
-- Name: exams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exams_id_seq', 3, true);


--
-- TOC entry 5698 (class 0 OID 0)
-- Dependencies: 236
-- Name: expenses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.expenses_id_seq', 1, false);


--
-- TOC entry 5699 (class 0 OID 0)
-- Dependencies: 249
-- Name: fee_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.fee_items_id_seq', 1, false);


--
-- TOC entry 5700 (class 0 OID 0)
-- Dependencies: 230
-- Name: fee_structures_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.fee_structures_id_seq', 1, false);


--
-- TOC entry 5701 (class 0 OID 0)
-- Dependencies: 283
-- Name: grade_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.grade_audit_id_seq', 1, false);


--
-- TOC entry 5702 (class 0 OID 0)
-- Dependencies: 285
-- Name: grade_boundaries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.grade_boundaries_id_seq', 13, true);


--
-- TOC entry 5703 (class 0 OID 0)
-- Dependencies: 281
-- Name: grades_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.grades_id_seq', 1, false);


--
-- TOC entry 5704 (class 0 OID 0)
-- Dependencies: 246
-- Name: guardians_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.guardians_id_seq', 1, false);


--
-- TOC entry 5705 (class 0 OID 0)
-- Dependencies: 234
-- Name: income_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.income_id_seq', 1, false);


--
-- TOC entry 5706 (class 0 OID 0)
-- Dependencies: 253
-- Name: invoice_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.invoice_items_id_seq', 1, false);


--
-- TOC entry 5707 (class 0 OID 0)
-- Dependencies: 251
-- Name: invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.invoices_id_seq', 1, false);


--
-- TOC entry 5708 (class 0 OID 0)
-- Dependencies: 218
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.migrations_id_seq', 21, true);


--
-- TOC entry 5709 (class 0 OID 0)
-- Dependencies: 258
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- TOC entry 5710 (class 0 OID 0)
-- Dependencies: 255
-- Name: payment_allocations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_allocations_id_seq', 1, false);


--
-- TOC entry 5711 (class 0 OID 0)
-- Dependencies: 232
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payments_id_seq', 1, false);


--
-- TOC entry 5712 (class 0 OID 0)
-- Dependencies: 268
-- Name: payroll_deductions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payroll_deductions_id_seq', 1, false);


--
-- TOC entry 5713 (class 0 OID 0)
-- Dependencies: 264
-- Name: payroll_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payroll_items_id_seq', 1, false);


--
-- TOC entry 5714 (class 0 OID 0)
-- Dependencies: 266
-- Name: payroll_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payroll_payments_id_seq', 1, false);


--
-- TOC entry 5715 (class 0 OID 0)
-- Dependencies: 270
-- Name: payroll_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payroll_reports_id_seq', 1, false);


--
-- TOC entry 5716 (class 0 OID 0)
-- Dependencies: 262
-- Name: payroll_runs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payroll_runs_id_seq', 1, false);


--
-- TOC entry 5717 (class 0 OID 0)
-- Dependencies: 273
-- Name: schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.schedules_id_seq', 3, true);


--
-- TOC entry 5718 (class 0 OID 0)
-- Dependencies: 228
-- Name: students_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.students_id_seq', 5, true);


--
-- TOC entry 5719 (class 0 OID 0)
-- Dependencies: 260
-- Name: subjects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subjects_id_seq', 19, true);


--
-- TOC entry 5720 (class 0 OID 0)
-- Dependencies: 220
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 4, true);


-- Completed on 2025-12-14 23:31:50

--
-- PostgreSQL database dump complete
--