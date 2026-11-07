from function.whack import whack


possibleChanges = []

def getUserinput(goal, route):
    for x in route:
        print(x)
    print("\n"+goal)
    return input("> ")

def main():
    whackList = whack()
    print(whackList)
    for x in range(len(whackList)-1):
        if len(whackList[x])==len(whackList[x+1]):
            possibleChanges.append(x)

    for y in range(len(possibleChanges)):
        current = whackList[possibleChanges[y]]
        route=[whackList[possibleChanges[y]]]
        goal = whackList[possibleChanges[y]+1]
        while current!=whackList[possibleChanges[y]+1]:
            input = getUserinput(goal, route)
            changesCount = 0
            for x in range(len(input)):
                if input[x]!=current[x]:
                    changesCount+=1
            if changesCount<=1:
                current = input
                route.append(current)

        print("Congrats")

if __name__ == "__main__":
    main()