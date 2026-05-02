import openpyxl
import sys

try:
    wb = openpyxl.load_workbook('MR FORMAT.xlsx', data_only=True)
    ws = wb.active
    print(f"Sheet Name: {ws.title}")
    print("-" * 40)
    for row in ws.iter_rows(values_only=True):
        # Filter out rows that are entirely None to find the structure
        if any(cell is not None for cell in row):
            print(row)
except Exception as e:
    print(f"Error: {e}")
