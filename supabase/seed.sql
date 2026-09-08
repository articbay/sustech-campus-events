-- Fictional development data only. Do not place real student records here.
insert into private.school_personnel
  (full_name, student_employee_id, email, department, college_system, role)
values
  ('演示学生A', 'DEMO0001', 'demo.student.a@example.invalid', '计算机科学与工程系', '致仁书院', 'student'),
  ('演示学生B', 'DEMO0002', 'demo.student.b@example.invalid', '商学院', '树德书院', 'student')
on conflict (student_employee_id) do nothing;

insert into public.events (
  title,
  description,
  location,
  event_time,
  max_attendees,
  organizer_id,
  organizer_name,
  organization,
  category,
  college,
  department,
  college_system,
  club,
  status,
  source
) values
  (
    '校园数据创新工作坊',
    '围绕校园场景完成数据分析与可视化实践。',
    '工学院南楼',
    now() + interval '30 days',
    60,
    null,
    '数据科学社',
    '社团联合会',
    '学术科技',
    '工学院',
    '计算机科学与工程系',
    null,
    null,
    'published',
    'seed'
  ),
  (
    'AI 与商业分析讲座',
    '分享人工智能在商业决策与运营分析中的应用。',
    '商学院报告厅',
    now() + interval '45 days',
    120,
    null,
    '商学院职业发展中心',
    '商学院',
    '职业发展',
    '商学院',
    null,
    null,
    null,
    'published',
    'seed'
  );
