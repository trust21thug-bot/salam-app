"""Generate mission PDF from DOCX template using Word COM automation.
Reads input from environment variables to avoid encoding issues."""
import sys, os, traceback, subprocess, json

def main():
    try:
        # Read from env vars (avoid CLI encoding issues)
        template_path = os.environ.get("TEMPLATE_PATH", "")
        output_pdf = os.environ.get("OUTPUT_PDF", "")
        manager = os.environ.get("MANAGER_NAME", "")
        destination = os.environ.get("DESTINATION", "")
        trip_date = os.environ.get("TRIP_DATE", "")
        print_date = os.environ.get("PRINT_DATE", "")

        # Kill any lingering WINWORD processes
        subprocess.run(
            ["taskkill", "/f", "/im", "WINWORD.EXE"],
            capture_output=True, text=True, timeout=10
        )

        import win32com.client as win32

        word = win32.gencache.EnsureDispatch("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0

        doc = word.Documents.Open(os.path.abspath(template_path), False, False)

        # Placeholder replacements
        replacements = [
            # (مدير الرحلة) -> (manager name)
            ("(%s %s)" % (chr(0x645)+chr(0x62F)+chr(0x64A)+chr(0x631),
                          chr(0x627)+chr(0x644)+chr(0x631)+chr(0x62D)+chr(0x644)+chr(0x629)),
             "(%s)" % (manager or chr(0x200F)*14)),
            # (الوجهة) -> (destination) with LTR embedding for correct bidi of Latin text in RTL context
            ("(%s)" % (chr(0x627)+chr(0x644)+chr(0x648)+chr(0x62C)+chr(0x647)+chr(0x629)),
             "(\u202A%s\u202C)" % destination if destination else "(" + chr(0x200F)*14 + ")"),
            # (تاريخ الرحلة) -> (trip date)
            ("(%s %s)" % (chr(0x62A)+chr(0x627)+chr(0x631)+chr(0x64A)+chr(0x62E),
                          chr(0x627)+chr(0x644)+chr(0x631)+chr(0x62D)+chr(0x644)+chr(0x629)),
             "(%s)" % (trip_date or chr(0x200F)*14)),
            # (يوم الطباعة) -> (print date)
            ("(%s %s)" % (chr(0x64A)+chr(0x648)+chr(0x645),
                          chr(0x627)+chr(0x644)+chr(0x637)+chr(0x628)+chr(0x627)+chr(0x639)+chr(0x629)),
             "(%s)" % (print_date or chr(0x200F)*14)),
        ]

        for old, new in replacements:
            find = word.Selection.Find
            find.ClearFormatting()
            find.Replacement.ClearFormatting()
            find.Text = old
            find.Replacement.Text = new
            find.Forward = True
            find.Wrap = 1
            find.Format = False
            find.MatchCase = False
            find.MatchWholeWord = False
            find.Execute(Replace=2)

        pdf_path = os.path.abspath(output_pdf)
        doc.SaveAs(pdf_path, 17)
        doc.Close(0)
        word.Quit()

        print("OK:%s" % pdf_path)
        return 0
    except Exception as e:
        traceback.print_exc()
        print("ERROR:%s" % str(e))
        return 1

if __name__ == "__main__":
    sys.exit(main())
