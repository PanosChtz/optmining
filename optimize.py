FILE_OUTPUT = False
import numpy as np
import math
import sys

from scipy.optimize import minimize
if FILE_OUTPUT:
    import matplotlib as mpl
    mpl.use('pgf')
import matplotlib.pyplot as plt
#from matplotlib import pyplot as plt

#Globals
RHO_FROM = 1E-05
RHO_TO = 1E-04
X_RESOLUTION = 121
global pps_glob
pps_glob = False
#Case 1 (single currency)
def solvePools(poolData, rho, R, lA, PPS = False, debug=False, formatStr = '%s'):
    '''
    Determines how much power should be put into each minimg pool based on their power and fees

    Args:
        poolData (List<Tuple<float, float>>): The mining power and fees for each pool.
        rho (float): CARA - constant absolute risk aversion.
        R (float): Reward per block.
        lA (float): Miner's total hashing power.
        debug (bool): Enable debugging messsages. (default: False)
        formatStr (str): Custom format string. (default: '%s')

    Returns:
        numpy array: A vector representing how much power to put towards each mining pool.
                     Returns None if optimization fails
    '''

    def objective(x, sign= -1.0):
        total = 0
        if PPS:
            for i, (xi, pooli) in enumerate(zip(x, poolData)):
                Li, fi = pooli
                if (i == len(poolData)-2):
                    total = total + xi*(1 - fi)*rho*R
                    #print("pooldata:" + str(poolData))
                    #print("xi:"+str(xi))
                    #print("fi:"+str(fi))
                else:
                    total = total + (xi + Li)*(1 - math.exp((-1)*rho*R*(1-fi)*xi/(xi+Li)))
        else:
            for xi, pooli in zip(x, poolData):
                Li, fi = pooli
                total = total + (xi + Li)*(1 - math.exp((-1)*rho*R*(1-fi)*xi/(xi+Li)))
        #uncomment if needed to scale down
        #total = round((total)**(1),18)
        total *= sign
        return total

    def constraint1(x, sign= -1.0):
        return sign*(sum(x) - lA)

    def constraint2(x, sign= -1.0):
        return (x - 0)

    poolData.append((0,0)) #append solo pool
    n = len(poolData)
    poolData = [list(l) for l in poolData] #convert to list of lists
    minHash = poolData[0][0]
    for m in range (0,n-1): #Find smallest value of pool hashrates except solo pool
        if (poolData[m][0] < minHash):
            minHash = poolData[m][0]
    minHash = lA #(override: normalize to lA)
    for m in range (0,n): #normalize pool hashrates to minHash
        poolData[m][0] = poolData[m][0]/minHash
    lA = lA/minHash #normalize miner hashrate to minHash
    x0 = np.ones(n) * lA/n  # Initial guess
    global guess
    guess = x0 #store initial guess to global variable
    #global pps_glob
    pps_glob = PPS
    if debug:
        print('Initial Objective: {formatStr}'.format(formatStr=formatStr) % objective(x0))

    #b = (0,lA)
    #bnds = (b,) * n
    con1 = {'type': 'ineq', 'fun': constraint1}
    con2 = {'type': 'ineq', 'fun': constraint2}
    cons = ([con1,con2])

    solution = minimize(objective,x0,method='COBYLA',\
                            constraints=cons,options={'maxiter': 50000, 'disp': False, 'tol' : 1e-65, 'catol' : 1e-15})
    x = solution.x
    #scale back to original values
    x = minHash*x
    lA = minHash*lA

    global curr_num #number of currencies used for graphs
    curr_num = 1

    if debug:
        # show final objective
        print('Final Objective:   {formatStr}'.format(formatStr=formatStr) % objective(x))

        # print solution
        print('Solution')
        for n, xi in enumerate(x):
            if (n<len(poolData)-1):
                print('l_%d    = {formatStr}'.format(formatStr=formatStr) % (n, xi))
            else:
                print('l_solo    = {formatStr}'.format(formatStr=formatStr) % (xi))
        print(    'l_unused = {formatStr}'.format(formatStr=formatStr) % (lA - sum(x)))

    if solution.success:
        #x = np.append(x,(lA - sum(x))) #append solo mining to end of numpy array output
        return x

    return None

#Case 2 (multiple currencies, single PoW algorithm)
def solvePoolsMultiCurr(poolData, rho, lA, debug=False, formatStr = '%s'):
    '''
    Determines how much power should be put into each minimg pool based on their power and fees

    Args:
        poolData (List<Tuple<float, float, float, float, float,>>): For each pool: mining power, fees, currency block reward Rc, currency block time Dc, currency total hashrate Lc.
        rho (float): CARA - constant absolute risk aversion.
        lA (float): Miner's total hashing power.
        debug (bool): Enable debugging messsages. (default: False)
        formatStr (str): Custom format string. (default: '%s')

    Returns:
        numpy array: A vector representing how much power to put towards each mining pool.
                     Returns None if optimization fails
    '''

    def objective(x, sign= -1.0):
        total = 0
        for xi, pooli in zip(x, poolData):
            Li, fi, Ri, Di, Lc = pooli
            total += (xi + Li)/(Di*Lc)*(1 - math.exp((-1)*rho*Ri*(1-fi)*xi/(xi+Li)))
        total *= sign
        return total

    def constraint1(x, sign= -1.0):
        return sign*(sum(x) - lA)
    def constraint2(x, sign= -1.0):
	    return (x - 0)

    C_all = [] #Holds the currency data for each pool
    for y in poolData:
        C_all.append(y[2:5])
    #C_all_tup = [tuple(l) for l in C_all]
    C = list(set(C_all)) #Make the unique currency data list
    for z in C:
        poolData.append((0,0,z[0],z[1],z[2])) #appends unique solo mining currencies
        #to poolData where mining power = 0 and fees = 0
    n = len(poolData)
    poolData = [list(l) for l in poolData] #convert to list of lists
    minHash = poolData[0][0]
    for m in range (0,n-len(C)): #Find smallest value of pool hashrates (exclude solo currencies)
        if (poolData[m][0] < minHash):
            minHash = poolData[m][0]
    minHash = lA #(override: normalize to lA)
    for m in range (0,n):
        poolData[m][0] = poolData[m][0]/minHash #normalize pool hashrates to minHash
        poolData[m][4] = poolData[m][4]/minHash #normalize currency hashrates to minHash
    lA = lA/minHash #normalize miner hashrate to minHash

    x0 = np.ones(n) * lA/(n)
    global guess
    guess = x0 #store guess to global variable
    if debug:
        print('Initial Objective: {formatStr}'.format(formatStr=formatStr) % objective(x0))
    #b = (0,lA)
    #bnds = (b,) * n
    con1 = {'type': 'ineq', 'fun': constraint1}
    con2 = {'type': 'ineq', 'fun': constraint2}
    cons = ([con1,con2])
    solution = minimize(objective,x0,method='COBYLA',\
                            constraints=cons,options={'maxiter': 50000, 'disp': False, 'tol' : 1e-65, 'catol' : 1e-15})
    x = solution.x
    #scale back to original values
    x = minHash*x
    lA = minHash*lA

    global curr_num
    curr_num = len(C)

    if debug:
        # show final objective
        print('Final Objective:   {formatStr}'.format(formatStr=formatStr) % objective(x))

        # print solution
        print('Solution')
        curr_ctr = 1
        for n, xi in enumerate(x):
            if (n<len(poolData)-len(C)):
                print('l_%d    = {formatStr}'.format(formatStr=formatStr) % (n, xi))
            else:
                print('Currency',curr_ctr, 'with data:', C[curr_ctr-1])
                print('l_c%d    = {formatStr}'.format(formatStr=formatStr) % (curr_ctr, xi))
                curr_ctr = curr_ctr + 1
        print(    'l_unused = {formatStr}'.format(formatStr=formatStr) % (lA - sum(x)))

    if solution.success:
        return x

    return None

#Case 3 (multiple currencies, multiple PoW algorithm)
def solvePoolsMultiAlg(poolData, rho, debug=False, formatStr = '%s'):
    '''
    Determines how much power should be put into each minimg pool based on their power and fees
    This works for multiple currencies under different PoW algorithms

    Args:
        poolData (List<Tuple<float, float, float, float, float, float>>): For each pool: mining power, fees, currency block reward Rc, currency block time Dc, currency total hashrate Lc, maximum hashrate for algorithm a la.
        rho (float): CARA - constant absolute risk aversion.
        debug (bool): Enable debugging messsages. (default: False)
        formatStr (str): Custom format string. (default: '%s')

    Returns:
        numpy array: A vector representing how much power to put towards each mining pool.
                     Returns None if optimization fails
    '''

    def objective(x, sign= -1.0):
        total = 0
        A = dict.fromkeys(set(A_all),0) #reset all dictionary values
        for xi, pooli in zip(x, poolData):
            Li, fi, Ri, Di, Lc, ai = pooli
            total += (xi + Li)/(Di*Lc)*(1 - math.exp((-1)*rho*Ri*(1-fi)*xi/(xi+Li)))
            A[ai] += xi
        total *= sign
        return total

    def constraint1(x, sign= -1.0):
        sumx = 0
        j=0
        for i in x:
            sumx += x[j]/poolData[j][5]
            j +=1
        return sign*(sumx - 1)
    def constraint2(x, sign= -1.0):
        return (x - 0)
    '''
    A_all = [] #Holds the algorithm maximum hashrate for each pool
    for v in poolData:
        A_all.append(v[5]) #Read data from function input
    A_unique = dict.fromkeys(set(A_all),0) #Make the algorithm hashrate dictionary
    for alg in poolData:
        A_unique[alg[5]] += 1 #Populate dictionary with algorithm use count
    '''
    def f7(seq):
        seen = set()
        seen_add = seen.add
        return [x for x in seq if not (x in seen or seen_add(x))]

    C_all = [] #Holds the currency data for each pool
    for y in poolData:
        C_all.append(y[2:6])
    C = f7(C_all)
    #C = list(set(C_all)) #Make the unique currency data list
    for z in C:
        poolData.append((0,0,z[0],z[1],z[2],z[3])) #appends unique solo mining currencies
        #to poolData where mining power = 0 and fees = 0

    n = len(poolData)
    poolData = [list(l) for l in poolData] #convert to list of lists


    minHash = poolData[0][0]

    for m in range (0,n-len(C)): #Find smallest value of pool hashrates (exclude solo currencies)
        if (poolData[m][0] < minHash):
            minHash = poolData[m][0]

    for m in range (0,n):
        poolData[m][0] = poolData[m][0]/minHash #normalize pool hashrates to smallest
        poolData[m][4] = poolData[m][4]/minHash #normalize currency hashrates to smallest
        poolData[m][5] = poolData[m][5]/minHash #normalize miner algo hashrate to smallest
    A_all = [] #Holds the algorithm maximum hashrate for each pool
    for v in poolData:
        A_all.append(v[5]) #Read data from function input
    A_unique = dict.fromkeys(set(A_all),0) #Make the algorithm hashrate dictionary
    for alg in poolData:
        A_unique[alg[5]] += 1 #Populate dictionary with algorithm use count

    x0 = [h[5]/(A_unique[h[5]]+1) for h in poolData] #Initial guess: divide equally per algorithm
    global guess
    guess = x0 #store guess to global variable


    if debug:
        print('Initial Objective: {formatStr}'.format(formatStr=formatStr) % objective(x0))
    #b = (0,max(A_all)) #Use as upper bound the maximum hashrate of all algos, need to check for correctness
    #bnds = (b,) * n
    con1 = {'type': 'ineq', 'fun': constraint1}
    con2 = {'type': 'ineq', 'fun': constraint2}
    cons = ([con1,con2])
    solution = minimize(objective,x0,method='COBYLA',\
                            constraints=cons,options={'maxiter': 50000, 'disp': False, 'tol' : 1e-65, 'catol' : 1e-15})

    #scale back to original values
    x = solution.x
    x = minHash*x


    global curr_num
    curr_num = len(C)

    if debug:
        # show final objective
        print('Final Objective:   {formatStr}'.format(formatStr=formatStr) % objective(x))

        # print solution
        print('Solution')
        curr_ctr = 1
        for n, xi in enumerate(x):
            if (n<len(poolData)-len(C)):
                print('l_%d    = {formatStr}'.format(formatStr=formatStr) % (n, xi))
            else:
                print('Currency',curr_ctr, 'with data:', C[curr_ctr-1])
                print('l_c%d    = {formatStr}'.format(formatStr=formatStr) % (curr_ctr, xi))
                curr_ctr = curr_ctr + 1

    if solution.success:
        return x

    return None


if __name__ =='__main__':
    if sys.argv[1] == "single": # single currency
    	data = map(float, sys.argv[2].split(','))
    	poolData = []
    	for i in range (len(data)):
    		if i % 2 == 0:
    			poolData.append((data[i], data[i+1]));
    	rho = float(sys.argv[3])
    	R = float(sys.argv[4])
    	lA = float(sys.argv[5])
    	print(solvePools(poolData, rho, R, lA))

    elif sys.argv[1] == "multicurr": # multi currencies, single PoW
        data = map(float, sys.argv[2].split(','))
        poolData = []
        for i in range (len(data)):
            if i % 5 == 0:
                poolData.append((data[i], data[i+1], data[i+2], data[i+3], data[i+4]));
        rho = float(sys.argv[3])
        lA = float(sys.argv[4])
        print(solvePoolsMultiCurr(poolData, rho,lA));

    elif sys.argv[1] == "multialgo":
        data = map(float, sys.argv[2].split(','))
        poolData = []
        for i in range (len(data)):
            if i % 6 == 0:
                poolData.append((data[i], data[i+1], data[i+2], data[i+3], data[i+4], data[i+5]));
        rho = float(sys.argv[3])
        print(solvePoolsMultiAlg(poolData, rho))
    sys.stdout.flush()


#Plot results section
#uncomment to enable
'''
failures = 0
x = np.linspace(RHO_FROM,RHO_TO,X_RESOLUTION) #typical values for rho are between 0.00001 and 0.0001
resultSet = [] #initialize list to store results


for i in range(0, len(x)): #Populate results list for each value of rho
    rho = round(x[i],9)

    #comment/uncomment below one line at a time as necessary
    #1st case:
    #'nice' example graph w/ 4 pools
    #result = xx
    #Miner hashrate decreases w/ 5 pools:
    #Figure 1 single crypto
    #result = solvePools([(1E+6, 0.02), (1E+5, 0.02), (1E+4, 0.01), (1E+3,0.00)], rho, 50000,4e+1)
    #filename = 'single_crypto'

    #result = solvePools([(1E+6, 0.03), (1E+5, 0.02),(0,1)], rho, 80000,4e+2,PPS=True)

    #Meeting
    #result = solvePools([(1E+6, 0.02), (1E+5, 0.02), (1E+4, 0.01), (1E+3,0)], rho, 50000,4e+1)

    #'real' litecoin values
    #result = solvePools([(57E+6, 0.02), (36E+6, 0.02), (0.39E+6, 0.02)], rho, 1280,5000)
    #result = solvePools([(57E+6, 0.02), (36E+6, 0.02), (0.39E+6, 0.02),(1,0.04)], rho, 1280,5000,PPS=True)
    #'real' bitcoin values w/ 4 pools and 1 small ASIC
    #result = solvePools([(8.762E+18, 0.02), (5.816E+18, 0.02), (4.24E+18, 0.02),(3.23E+18, 0.02)], rho,76000,4.7E+12)
    #result = solvePools([(1.8678E+10, 0.02), (1.2398E+10, 0.02), (9.0385E+9, 0.02),(6.8854e+9, 0.02)], rho,76000,4.7E+1)
    #result = solvePools([(8.762E+18, 0.03), (5.816E+18, 0.02), (4.24E+18, 0.01),(3.23E+18, 0.04)], rho,76000,4.7E+15, PPS=True)

    #'real' bitcoin values but miner very small (unrealistic)
    #result = solvePools([(8.762E+18, 0.02), (5.816E+18, 0.02), (4.24E+18, 0.02),(3.23E+18, 0.02)], rho,76000,4.7E+11)
    #Large bitcoin miner (1000 ASICS) w/ 3 pools
    #result = solvePools([(8.762E+18, 0.03), (5.816E+18, 0.02), (4.24E+18, 0.01)], rho,76000,12.5E+15)

    #Figure 2
    #result = solvePools([(5.587E+18, 0.02), (4.601E+18, 0.02), (0.328E+18, 0.009)], rho,81924,12.5E+15)
    #result = solvePools([(5.750E+18, 0.02), (4.601E+18, 0.02), (0.452E+18, 0.009)], rho,80135,12.5E+15)
    #filename = 'single_crypto2'

    #Appendix B1 #RHO_TO = 5E-04
    #result = solvePools([(5.750E+18, 0.02), (4.601E+18, 0.02), (0.452E+18, 0.009),(0,0.04)], rho,80135,12.5E+15,PPS=True)
    #filename = 'single_crypto_pps'
    #result = solvePools([(5.750E+18, 0.02), (4.601E+18, 0.02), (0.452E+18, 0.009),(0,0.03)], rho,80135,12.5E+13,PPS=True)
    #2nd case:
    #same with 1st case 'nice' example
    #result=solvePoolsMultiCurr([(1E+6, 0.03,50000,1,1E+6), (1E+5, 0.02,50000,1,1E+6), (1E+4, 0.01,50000,1,1E+6)], float(x[i]),1e+2)

    #more 'nice' examples
    #result=solvePoolsMultiCurr([(1E+6, 0.03,50000,2,5E+6), (1E+5, 0.02,50000,2,5E+6),(5E+4, 0.04,20000,3,4E+6)], float(x[i]),1e+3)
    #result=solvePoolsMultiCurr([(1E+6, 0.03,40000,2,5E+6), (1E+5, 0.02,50000,2,5E+6),(8E+4, 0.04,50000,2,5E+6)], float(x[i]),1e+3)

    #'real' litecoin values
    #result=solvePoolsMultiCurr([(57E+12, 0.02,1290,155,241E+9), (36E+12, 0.01,1290,155,241E+9), (390E+9, 0.005,1290,155,241E+9)], float(x[i]),500E+6)

    #'real' litecoin & dogecoin values ('flipping' observation)
    #result=solvePoolsMultiCurr([(57E+12, 0.03,1290,155,241e+12),(36E+12, 0.02,1290,155,241e+12), (420E+9, 0.02,21,62,215e+12)], float(x[i]),5000e+6)

    #'real' bitcoin & bitcoin cash values Slush-Via-Kano
    #result=solvePoolsMultiCurr([(5.750E+18, 0.02,80135,600,50.24e+18),(0.559E+18, 0.02,80135*0.06957,600,3.51e+18), (0.452E+18, 0.009,80135,600,50.24e+18)], float(x[i]),12.5e+15)
    #filename = 'multi_crypto'

    #Appendix B2
    #result=solvePoolsMultiCurr([(5.750E+18, 0.02,80135,600,50.24e+18),(0.559E+18, 0.02,80135*0.07086,600,3.51e+18), (0.452E+18, 0.009,80135,600,50.24e+18)], float(x[i]),12.5e+15)
    #filename = 'multi_crypto_before'
    #Appendix B3
    #result=solvePoolsMultiCurr([(5.750E+18, 0.02,80135,600,50.24e+18),(0.559E+18, 0.02,80135*0.06889,600,3.51e+18), (0.452E+18, 0.009,80135,600,50.24e+18)], float(x[i]),12.5e+15)
    #filename = 'multi_crypto_after'

    #Appendix B4
    #result = solvePools([(5.750E+18, 0.02), (4.601E+18, 0.02), (0.452E+18, 0.009)], rho,80135,12.5E+13)
    #filename = 'single_crypto_small'
    #3rd case:
    #same with 1st case 'nice' example
    #result=solvePoolsMultiAlg([(1E+6, 0.03,50000,1,1e+6,1e+2), (1E+5, 0.02,50000,1,1e+6,1e+2), (1E+4, 0.01,50000,1,1e+6,1e+2)], float(x[i]))

    #'real' ethereum & monero values ('flipping' observation)
    #values for one AMD 470 4GB GPU from https://whattomine.com/
    #result=solvePoolsMultiAlg([(68E+12, 0.01,1026,0.25,278e+12,26e+6), (37E+6, 0.01,375,2,422e+6,730)], float(x[i]))

    #Count solving failures
    if (i == 0):
        prevResult = guess
    if (result is not None):
        resultSet.append(list(result))
        prevResult = result
    else: #result None = failed
        resultSet.append(list(prevResult))
        failures +=1

print("Failures",failures, "out of",len(x) )
poolCount = len(resultSet[0]) #number of different pools plus 'solo' pools
labelList = [] #initialize list for legend names

#for i in range(0,poolCount-curr_num):
#    labelList.append("Pool "+str(i+1))
#if pps_glob: labelList[poolCount-curr_num-1]="PPS Pool"
labelList.append("Slush Pool")
#labelList.append("ViaBTC")
labelList.append("ViaBTC (Bitcoin Cash)")
labelList.append("KanoPool")
#labelList.append("PPS Pool")

plt.rc('text', usetex=True)
plt.rc('font', family='serif', size='10')

#fig, ax1 = plt.subplots(num=None, figsize=(7, 5), dpi=150, facecolor='w', edgecolor='k')
fig, ax1 = plt.subplots(figsize=(5.4, 2.7))
#fig, ax1 = plt.subplots(num=None, figsize=(3.0, 3.5), dpi=200, facecolor='w', edgecolor='k')

for j in range(poolCount-curr_num,poolCount):
    labelList.append("Solo "+str(j+2-poolCount))

#ax1.plot(list(x),resultSet,linewidth=0.6)
ax1.plot(list(x),resultSet,linewidth=1)

ax1.set_xlabel('CARA',labelpad=-1)
ax1.tick_params(axis="x",direction="in", pad=2)
#xticklabel style = {xshift=-0.75cm}
ax1.set_ylabel("Hash rate")

plt.legend(labelList,fancybox=True, framealpha=0.0)

if FILE_OUTPUT:
    plt.savefig(filename+'.pgf')
#plt.savefig('test', dpi=None, facecolor='w', edgecolor='w',orientation='portrait', papertype=None, format=None,transparent=False, bbox_inches=None, pad_inches=0.1,frameon=None, metadata=None)
else:
    plt.show()
'''
