def optimize_staff(queue_size,current_staff):
    required=max(current_staff, queue_size//4+1)
    return {'current_staff':current_staff,'required_staff':required,'action':'OPEN_COUNTER' if required>current_staff else 'OK'}
