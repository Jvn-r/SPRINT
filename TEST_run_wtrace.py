#This was used during testing of wtrace, didnt work cuz didnt have admin

import subprocess
subprocess.Popen(["wtrace.exe > outputFile.txt"],shell = True)

