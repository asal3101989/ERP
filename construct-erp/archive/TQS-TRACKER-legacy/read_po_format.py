import openpyxl

path = r'h:\TQS-SERVER\TEST\codex review\Purcahs order format.xlsx'
wb = openpyxl.load_workbook(path, data_only=True)
sheet = wb.active

for row in sheet.iter_rows(min_row=1, max_row=100, min_col=1, max_col=20):
    row_data = [str(cell.value) if cell.value is not None else "" for cell in row]
    if any(row_data):
        print("|".join(row_data))
