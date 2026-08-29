"""
สคริปต์สรุปเงินเดือน/ค่าใช้จ่าย จากไฟล์ Excel
ใช้: python summary.py data.xlsx
ไฟล์ต้องมีคอลัมน์: วันที่ | ประเภท (รายรับ/รายจ่าย) | หมวดหมู่ | จำนวนเงิน
ผลลัพธ์: พิมพ์สรุปในหน้าจอ + สร้างไฟล์ summary.xlsx
"""

import sys
import pandas as pd


def load_data(path: str) -> pd.DataFrame:
    df = pd.read_excel(path)
    df["วันที่"] = pd.to_datetime(df["วันที่"])
    df["เดือน"] = df["วันที่"].dt.to_period("M").astype(str)
    return df


def summarize(df: pd.DataFrame):
    income = df[df["ประเภท"] == "รายรับ"]["จำนวนเงิน"].sum()
    expense = df[df["ประเภท"] == "รายจ่าย"]["จำนวนเงิน"].sum()
    net = income - expense

    by_category = (
        df[df["ประเภท"] == "รายจ่าย"]
        .groupby("หมวดหมู่")["จำนวนเงิน"]
        .sum()
        .sort_values(ascending=False)
    )

    by_month = (
        df.groupby(["เดือน", "ประเภท"])["จำนวนเงิน"]
        .sum()
        .unstack(fill_value=0)
    )

    return income, expense, net, by_category, by_month


def print_report(income, expense, net, by_category, by_month):
    print("=" * 40)
    print("สรุปภาพรวม")
    print("=" * 40)
    print(f"รายรับรวม   : {income:,.2f} บาท")
    print(f"รายจ่ายรวม  : {expense:,.2f} บาท")
    print(f"คงเหลือสุทธิ: {net:,.2f} บาท")

    print("\nรายจ่ายแยกตามหมวดหมู่")
    print("-" * 40)
    for cat, amt in by_category.items():
        print(f"{cat:<15} {amt:>12,.2f} บาท")

    print("\nสรุปรายเดือน")
    print("-" * 40)
    print(by_month.to_string())


def save_report(by_category, by_month, out_path: str):
    with pd.ExcelWriter(out_path) as writer:
        by_category.to_frame("รวมรายจ่าย").to_excel(writer, sheet_name="แยกตามหมวดหมู่")
        by_month.to_excel(writer, sheet_name="สรุปรายเดือน")
    print(f"\nบันทึกสรุปไว้ที่ {out_path} แล้ว")


def main():
    if len(sys.argv) < 2:
        print("วิธีใช้: python summary.py ชื่อไฟล์.xlsx")
        sys.exit(1)

    path = sys.argv[1]
    df = load_data(path)
    income, expense, net, by_category, by_month = summarize(df)
    print_report(income, expense, net, by_category, by_month)
    save_report(by_category, by_month, "summary.xlsx")


if __name__ == "__main__":
    main()
