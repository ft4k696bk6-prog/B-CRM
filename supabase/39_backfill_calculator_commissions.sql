begin;

with base as (
  select
    c.id,
    c.product_type,
    c.gross_amount,
    c.panels_count,
    c.storage_capacity_kwh,
    c.has_inverter,
    c.inverter_power_kw,
    c.mounting_locations,
    c.backup_power,
    c.boiler_capacity,
    c.ems,
    c.cable_length_meters,
    c.pricing_adjustment_net,
    coalesce(p.commission_percent,0) as pct,
    round(c.gross_amount / 1.08, 2) as sale_net,
    case panels_count
  when 4 then 2
  when 5 then 2.5
  when 6 then 3
  when 7 then 3.5
  when 8 then 4
  when 9 then 4.5
  when 10 then 5
  when 11 then 5.5
  when 12 then 6
  when 13 then 6.5
  when 14 then 7
  when 15 then 7.5
  when 16 then 8
  when 17 then 8.5
  when 18 then 9
  when 19 then 9.5
  when 20 then 10
  when 21 then 10.5
  when 22 then 11
  when 23 then 11.5
  when 24 then 12
  when 25 then 12.5
  when 26 then 13
  when 27 then 13.5
  when 28 then 14
  when 29 then 14.5
  when 30 then 15
  when 31 then 15.5
  when 32 then 16
  when 33 then 16.5
  when 34 then 17
  when 35 then 17.5
  when 36 then 18
  when 37 then 18.5
  when 38 then 19
  when 39 then 19.5
  when 40 then 20
  else null end as calc_kwp,
    case
      when c.product_type = 'PV' then case panels_count
  when 4 then 36873
  when 5 then 37613
  when 6 then 38353
  when 7 then 39093
  when 8 then 39833
  when 9 then 40573
  when 10 then 41313
  when 11 then 43477
  when 12 then 44217
  when 13 then 46137
  when 14 then 46877
  when 15 then 47617
  when 16 then 48357
  when 17 then 49097
  when 18 then 49837
  when 19 then 50897
  when 20 then 51637
  when 21 then 52377
  when 22 then 53117
  when 23 then 53857
  when 24 then 54597
  when 25 then 55337
  when 26 then 56077
  when 27 then 56817
  when 28 then 57557
  when 29 then 58297
  when 30 then 59037
  when 31 then 59777
  when 32 then 60517
  when 33 then 61257
  when 34 then 61997
  when 35 then 62737
  when 36 then 63477
  when 37 then 64217
  when 38 then 64957
  when 39 then 65697
  when 40 then 66437
  else null end
      when c.product_type = 'PV+ME' and abs(c.storage_capacity_kwh - 5.12) <= 0.3 then case panels_count
  when 4 then 44556
  when 5 then 45296
  when 6 then 46036
  when 7 then 46776
  when 8 then 47516
  when 9 then 48256
  when 10 then 48996
  when 11 then 51160
  when 12 then 51900
  when 13 then 53820
  when 14 then 54560
  when 15 then 55300
  when 16 then 56040
  when 17 then 56780
  when 18 then 57520
  when 19 then 58580
  when 20 then 59320
  when 21 then 60060
  when 22 then 60800
  when 23 then 61540
  when 24 then 62280
  when 25 then 63020
  when 26 then 63760
  when 27 then 64500
  when 28 then 65240
  when 29 then 65980
  when 30 then 66720
  when 31 then 67460
  when 32 then 68200
  when 33 then 68940
  when 34 then 69680
  when 35 then 70420
  when 36 then 71160
  when 37 then 71900
  when 38 then 72640
  when 39 then 73380
  when 40 then 74120
  else null end
      when c.product_type = 'PV+ME' and abs(c.storage_capacity_kwh - 10.24) <= 0.3 then case panels_count
  when 4 then 46955
  when 5 then 47695
  when 6 then 48435
  when 7 then 49175
  when 8 then 49915
  when 9 then 50655
  when 10 then 51395
  when 11 then 53559
  when 12 then 54299
  when 13 then 56219
  when 14 then 56959
  when 15 then 57699
  when 16 then 58439
  when 17 then 59179
  when 18 then 59919
  when 19 then 60979
  when 20 then 61719
  when 21 then 62459
  when 22 then 63199
  when 23 then 63939
  when 24 then 64679
  when 25 then 65419
  when 26 then 66159
  when 27 then 66899
  when 28 then 67639
  when 29 then 68379
  when 30 then 69119
  when 31 then 69859
  when 32 then 70599
  when 33 then 71339
  when 34 then 72079
  when 35 then 72819
  when 36 then 73559
  when 37 then 74299
  when 38 then 75039
  when 39 then 75779
  when 40 then 76519
  else null end
      when c.product_type = 'PV+ME' and abs(c.storage_capacity_kwh - 16) <= 0.3 then case panels_count
  when 4 then 48889
  when 5 then 49629
  when 6 then 50369
  when 7 then 51109
  when 8 then 51849
  when 9 then 52589
  when 10 then 53329
  when 11 then 55493
  when 12 then 56233
  when 13 then 58153
  when 14 then 58893
  when 15 then 59633
  when 16 then 60373
  when 17 then 61113
  when 18 then 61853
  when 19 then 62913
  when 20 then 63653
  when 21 then 64393
  when 22 then 65133
  when 23 then 65873
  when 24 then 66613
  when 25 then 67353
  when 26 then 68093
  when 27 then 68833
  when 28 then 69573
  when 29 then 70313
  when 30 then 71053
  when 31 then 71793
  when 32 then 72533
  when 33 then 73273
  when 34 then 74013
  when 35 then 74753
  when 36 then 75493
  when 37 then 76233
  when 38 then 76973
  when 39 then 77713
  when 40 then 78453
  else null end
      when c.product_type = 'PV+ME' and abs(c.storage_capacity_kwh - 20) <= 0.3 then case panels_count
  when 4 then 53347
  when 5 then 54087
  when 6 then 54827
  when 7 then 55567
  when 8 then 56307
  when 9 then 57047
  when 10 then 57787
  when 11 then 59951
  when 12 then 60691
  when 13 then 62611
  when 14 then 63351
  when 15 then 64091
  when 16 then 64831
  when 17 then 65571
  when 18 then 66311
  when 19 then 67371
  when 20 then 68111
  when 21 then 68851
  when 22 then 69591
  when 23 then 70331
  when 24 then 71071
  when 25 then 71811
  when 26 then 72551
  when 27 then 73291
  when 28 then 74031
  when 29 then 74771
  when 30 then 75511
  when 31 then 76251
  when 32 then 76991
  when 33 then 77731
  when 34 then 78471
  when 35 then 79211
  when 36 then 79951
  when 37 then 80691
  when 38 then 81431
  when 39 then 82171
  when 40 then 82911
  else null end
      when c.product_type = 'PV+ME' and abs(c.storage_capacity_kwh - 23.5) <= 0.3 then case panels_count
  when 4 then 54077
  when 5 then 54817
  when 6 then 55557
  when 7 then 56297
  when 8 then 57037
  when 9 then 57777
  when 10 then 58517
  when 11 then 60681
  when 12 then 61421
  when 13 then 63341
  when 14 then 64081
  when 15 then 64821
  when 16 then 65561
  when 17 then 66301
  when 18 then 67041
  when 19 then 68101
  when 20 then 68841
  when 21 then 69581
  when 22 then 70321
  when 23 then 71061
  when 24 then 71801
  when 25 then 72541
  when 26 then 73281
  when 27 then 74021
  when 28 then 74761
  when 29 then 75501
  when 30 then 76241
  when 31 then 76981
  when 32 then 77721
  when 33 then 78461
  when 34 then 79201
  when 35 then 79941
  when 36 then 80681
  when 37 then 81421
  when 38 then 82161
  when 39 then 82901
  when 40 then 83641
  else null end
      when c.product_type = 'PV+ME' and abs(c.storage_capacity_kwh - 28) <= 0.3 then case panels_count
  when 4 then 56002
  when 5 then 56742
  when 6 then 57482
  when 7 then 58222
  when 8 then 58962
  when 9 then 59702
  when 10 then 60442
  when 11 then 62606
  when 12 then 63346
  when 13 then 65266
  when 14 then 66006
  when 15 then 66746
  when 16 then 67486
  when 17 then 68226
  when 18 then 68966
  when 19 then 70026
  when 20 then 70766
  when 21 then 71506
  when 22 then 72246
  when 23 then 72986
  when 24 then 73726
  when 25 then 74466
  when 26 then 75206
  when 27 then 75946
  when 28 then 76686
  when 29 then 77426
  when 30 then 78166
  when 31 then 78906
  when 32 then 79646
  when 33 then 80386
  when 34 then 81126
  when 35 then 81866
  when 36 then 82606
  when 37 then 83346
  when 38 then 84086
  when 39 then 84826
  when 40 then 85566
  else null end
      when c.product_type = 'ME' and abs(c.storage_capacity_kwh - 5.12) <= 0.3 then 30683
      when c.product_type = 'ME' and abs(c.storage_capacity_kwh - 10.24) <= 0.3 then 33082
      when c.product_type = 'ME' and abs(c.storage_capacity_kwh - 16) <= 0.3 then 35016
      when c.product_type = 'ME' and abs(c.storage_capacity_kwh - 20) <= 0.3 then 39474
      when c.product_type = 'ME' and abs(c.storage_capacity_kwh - 23.5) <= 0.3 then 40204
      when c.product_type = 'ME' and abs(c.storage_capacity_kwh - 28) <= 0.3 then 42129
      else null
    end as cennik_net,
    case
      when c.has_inverter = false then 0
      when abs(c.inverter_power_kw - 5) < 0.02 then 6500
      when abs(c.inverter_power_kw - 8) < 0.02 then 6700
      when abs(c.inverter_power_kw - 10) < 0.02 then 6900
      when abs(c.inverter_power_kw - 12) < 0.02 then 7100
      else null
    end as actual_inverter_net,
    case
      when (case panels_count
  when 4 then 2
  when 5 then 2.5
  when 6 then 3
  when 7 then 3.5
  when 8 then 4
  when 9 then 4.5
  when 10 then 5
  when 11 then 5.5
  when 12 then 6
  when 13 then 6.5
  when 14 then 7
  when 15 then 7.5
  when 16 then 8
  when 17 then 8.5
  when 18 then 9
  when 19 then 9.5
  when 20 then 10
  when 21 then 10.5
  when 22 then 11
  when 23 then 11.5
  when 24 then 12
  when 25 then 12.5
  when 26 then 13
  when 27 then 13.5
  when 28 then 14
  when 29 then 14.5
  when 30 then 15
  when 31 then 15.5
  when 32 then 16
  when 33 then 16.5
  when 34 then 17
  when 35 then 17.5
  when 36 then 18
  when 37 then 18.5
  when 38 then 19
  when 39 then 19.5
  when 40 then 20
  else null end) <= 5 then 6500
      when (case panels_count
  when 4 then 2
  when 5 then 2.5
  when 6 then 3
  when 7 then 3.5
  when 8 then 4
  when 9 then 4.5
  when 10 then 5
  when 11 then 5.5
  when 12 then 6
  when 13 then 6.5
  when 14 then 7
  when 15 then 7.5
  when 16 then 8
  when 17 then 8.5
  when 18 then 9
  when 19 then 9.5
  when 20 then 10
  when 21 then 10.5
  when 22 then 11
  when 23 then 11.5
  when 24 then 12
  when 25 then 12.5
  when 26 then 13
  when 27 then 13.5
  when 28 then 14
  when 29 then 14.5
  when 30 then 15
  when 31 then 15.5
  when 32 then 16
  when 33 then 16.5
  when 34 then 17
  when 35 then 17.5
  when 36 then 18
  when 37 then 18.5
  when 38 then 19
  when 39 then 19.5
  when 40 then 20
  else null end) <= 8 then 6700
      when (case panels_count
  when 4 then 2
  when 5 then 2.5
  when 6 then 3
  when 7 then 3.5
  when 8 then 4
  when 9 then 4.5
  when 10 then 5
  when 11 then 5.5
  when 12 then 6
  when 13 then 6.5
  when 14 then 7
  when 15 then 7.5
  when 16 then 8
  when 17 then 8.5
  when 18 then 9
  when 19 then 9.5
  when 20 then 10
  when 21 then 10.5
  when 22 then 11
  when 23 then 11.5
  when 24 then 12
  when 25 then 12.5
  when 26 then 13
  when 27 then 13.5
  when 28 then 14
  when 29 then 14.5
  when 30 then 15
  when 31 then 15.5
  when 32 then 16
  when 33 then 16.5
  when 34 then 17
  when 35 then 17.5
  when 36 then 18
  when 37 then 18.5
  when 38 then 19
  when 39 then 19.5
  when 40 then 20
  else null end) <= 10 then 6900
      when (case panels_count
  when 4 then 2
  when 5 then 2.5
  when 6 then 3
  when 7 then 3.5
  when 8 then 4
  when 9 then 4.5
  when 10 then 5
  when 11 then 5.5
  when 12 then 6
  when 13 then 6.5
  when 14 then 7
  when 15 then 7.5
  when 16 then 8
  when 17 then 8.5
  when 18 then 9
  when 19 then 9.5
  when 20 then 10
  when 21 then 10.5
  when 22 then 11
  when 23 then 11.5
  when 24 then 12
  when 25 then 12.5
  when 26 then 13
  when 27 then 13.5
  when 28 then 14
  when 29 then 14.5
  when 30 then 15
  when 31 then 15.5
  when 32 then 16
  when 33 then 16.5
  when 34 then 17
  when 35 then 17.5
  when 36 then 18
  when 37 then 18.5
  when 38 then 19
  when 39 then 19.5
  when 40 then 20
  else null end) is not null then 7100
      else null
    end as recommended_inverter_net
  from public.contracts c
  left join public.profiles p on p.id = c.created_by
  where c.crm_environment='production'
), calculated as (
  select *,
    case
      when product_type not in ('PV','ME','PV+ME') then 'Stara umowa nie ma konfiguracji zgodnej z aktualnym kalkulatorem.'
      when gross_amount <= 0 then 'Brakuje ceny sprzedaży brutto.'
      when product_type in ('PV','PV+ME') and calc_kwp is null then 'Kalkulator nie ma ceny dla tej liczby paneli.'
      when cennik_net is null then 'Kalkulator nie ma ceny dla tej konfiguracji magazynu.'
      when has_inverter <> false and actual_inverter_net is null then 'Kalkulator nie ma ceny dla tej mocy falownika.'
      else null
    end as calc_error,
    case
      when product_type not in ('PV','ME','PV+ME') or gross_amount <= 0 or cennik_net is null
        or (product_type in ('PV','PV+ME') and calc_kwp is null)
        or (has_inverter <> false and actual_inverter_net is null)
      then null
      else round(greatest(
        cennik_net
        + case when product_type='ME' then coalesce(actual_inverter_net,0) else coalesce(actual_inverter_net,0)-coalesce(recommended_inverter_net,0) end
        - 15000
        + case when product_type <> 'ME' and 'Grunt'=any(mounting_locations) then calc_kwp*550 else 0 end
        + case when product_type <> 'ME' and exists(select 1 from unnest(mounting_locations) m where lower(m) like '%ekierki%') then calc_kwp*500 else 0 end
        + case when backup_power then 1500 else 0 end
        + case boiler_capacity when '80' then 1500 when '150' then 2000 else 0 end
        + case when ems then 3000 else 0 end
        + greatest(coalesce(cable_length_meters,8)-8,0)*15
        + coalesce(pricing_adjustment_net,0)
      ,0),2)
    end as base_net
  from base
)
update public.contracts c
set
  commission_sale_net = x.sale_net,
  commission_base_net = x.base_net,
  commission_margin_net = case when x.base_net is null then 0 else round(x.sale_net-x.base_net,2) end,
  commission_percent = x.pct,
  commission_amount = case when x.base_net is null then 0 else round(greatest(x.sale_net-x.base_net,0)*x.pct/100,2) end,
  commission_calc_error = x.calc_error,
  commission_calculated_at = now()
from calculated x
where c.id=x.id;

commit;