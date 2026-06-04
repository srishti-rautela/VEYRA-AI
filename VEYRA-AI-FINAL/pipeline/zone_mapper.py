ZONES={

"ENTRY":
(0,0,25,100),


"DISPLAY":
(25,0,70,100),


"BILLING":
(70,0,100,100)

}


def find_zone(x,y):


    for name,pos in ZONES.items():

        x1,y1,x2,y2=pos


        if x1<=x<=x2 and y1<=y<=y2:

            return name


    return "WALKING"