# Remaining Items

## In Progress - Labor Cost Feature

### 1. Employee Pay Save Logic
- Update EmployeeDialog onSubmit to save to employee_pay table instead of users
- Add warehouse selector and salary_hourly_equivalent UI fields

### 2. Reports → Labor Costs Page (Admin Only)
- Create new page with filters: date range, warehouse, role, task type, employee
- Summary table grouped by Warehouse + Role (hours, cost, tasks)
- Employee drilldown (regular vs overtime hours, total cost)
- Task type drilldown (hours, cost)
- CSV export for each table

## Lower Priority

### 3. SMS/Twilio Integration
- Templates editor mentions SMS but Twilio is not configured

### 4. Tax Configuration  
- Tax calculations currently hardcoded to 0 in useBilling.ts

### 5. Billing Rate Field Proxies
- is_unstackable and is_crated flags use proxy rate fields

---
*Last updated: January 2026*
