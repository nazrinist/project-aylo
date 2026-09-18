insert into public.businesses (id, name, category, address, latitude, longitude, rating, verified)
values
  ('00000000-0000-4000-8000-000000000001', 'Glow Studio', 'beauty', 'Ağ Şəhər, Bakı', 40.3777, 49.8752, 4.9, true),
  ('00000000-0000-4000-8000-000000000002', 'Luna Beauty Bar', 'beauty', 'Ağ Şəhər, Bakı', 40.3783, 49.8768, 4.8, true),
  ('00000000-0000-4000-8000-000000000003', 'Mira Studio', 'beauty', 'Xətai, Bakı', 40.3830, 49.8728, 4.9, true),
  ('00000000-0000-4000-8000-000000000004', 'Nail Spot', 'beauty', 'Ağ Şəhər, Bakı', 40.3769, 49.8775, 4.7, true),
  ('00000000-0000-4000-8000-000000000005', 'Aura Beauty', 'beauty', 'Nərimanov, Bakı', 40.4029, 49.8722, 4.6, false),
  ('00000000-0000-4000-8000-000000000006', 'Soleil Studio', 'beauty', 'Səbail, Bakı', 40.3661, 49.8352, 4.8, true),
  ('00000000-0000-4000-8000-000000000007', 'Brow Lab', 'beauty', '28 May, Bakı', 40.3797, 49.8486, 4.9, true),
  ('00000000-0000-4000-8000-000000000008', 'Velvet Beauty', 'beauty', 'Ağ Şəhər, Bakı', 40.3790, 49.8741, 4.7, true),
  ('00000000-0000-4000-8000-000000000009', 'Muse Makeup', 'beauty', 'İçərişəhər, Bakı', 40.3667, 49.8352, 4.8, false),
  ('00000000-0000-4000-8000-000000000010', 'Blush Room', 'beauty', 'Gənclik, Bakı', 40.4003, 49.8525, 4.7, true),
  ('00000000-0000-4000-8000-000000000011', 'Iris Nails', 'beauty', 'Xətai, Bakı', 40.3822, 49.8712, 4.6, true),
  ('00000000-0000-4000-8000-000000000012', 'Nova Beauty House', 'beauty', 'Ağ Şəhər, Bakı', 40.3772, 49.8735, 4.9, true)
on conflict (id) do update set
  name = excluded.name,
  address = excluded.address,
  rating = excluded.rating,
  verified = excluded.verified;

insert into public.services (id, business_id, name, description, price, currency, duration_minutes, active)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Hair + Makeup', 'Event-ready hair and makeup', 95, 'AZN', 90, true),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Makeup', 'Professional makeup', 65, 'AZN', 60, true),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'Makeup', 'Soft or evening makeup', 70, 'AZN', 60, true),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', 'Hair + Makeup', 'Complete look', 110, 'AZN', 105, true),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004', 'Manicure', 'Classic manicure', 35, 'AZN', 60, true),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000005', 'Hair + Makeup', 'Hair styling and makeup', 85, 'AZN', 90, true),
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000006', 'Hair styling', 'Blowout and styling', 50, 'AZN', 60, true),
  ('10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000007', 'Brows + Lashes', 'Brow shaping and lash lift', 55, 'AZN', 75, true),
  ('10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000008', 'Hair + Makeup', 'Premium complete look', 120, 'AZN', 120, true),
  ('10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000009', 'Makeup', 'Day or evening makeup', 80, 'AZN', 60, true),
  ('10000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000010', 'Hair + Makeup', 'Complete look', 100, 'AZN', 90, true),
  ('10000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000011', 'Manicure + Pedicure', 'Nail care set', 60, 'AZN', 100, true),
  ('10000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000012', 'Hair + Makeup', 'Signature complete look', 105, 'AZN', 100, true)
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  duration_minutes = excluded.duration_minutes,
  active = excluded.active;

insert into public.availability (business_id, service_id, start_time, end_time, status)
select
  services.business_id,
  services.id,
  (current_date + days.day_offset + slots.slot_time) at time zone 'Asia/Baku',
  ((current_date + days.day_offset + slots.slot_time) at time zone 'Asia/Baku')
    + make_interval(mins => coalesce(services.duration_minutes, 60)),
  'available'
from public.services
cross join generate_series(1, 14) as days(day_offset)
cross join (values (time '10:00'), (time '14:00'), (time '18:00')) as slots(slot_time)
where services.id::text like '10000000-0000-4000-8000-%'
on conflict (service_id, start_time) do nothing;
