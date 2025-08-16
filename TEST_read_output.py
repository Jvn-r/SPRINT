#Just a proof of concept rn will add more bells and whistles as required depending on what i need for UI

with open("opfile.txt", "r") as f:
    while True:
        line = f.readline()
        if line:
            print("NEW LINE:", line.strip())

#Decided to run the parser with node.js instead