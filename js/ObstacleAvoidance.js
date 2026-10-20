function calculateObstacleAvoidance(vehicle, obstacles, detectionRadius, avoidanceSides) {
    vehicle.debugAhead = null;
    vehicle.debugAheadMid = null;
    vehicle.debugThreat = null;

    if (!avoidanceSides) {
        avoidanceSides = vehicle.avoidanceSides || (vehicle.avoidanceSides = new Map());
    }
    if (!obstacles || obstacles.length === 0) {
        avoidanceSides.clear();
        vehicle.lastAvoidForce.set(0, 0);
        return vehicle.lastAvoidForce.copy();
    }

    const forward = vehicle.vel.magSq() > 1e-4
        ? vehicle.vel.copy().normalize()
        : p5.Vector.fromAngle(vehicle.lastHeading || 0);
    if (vehicle.vel.magSq() > 1e-4) {
        vehicle.lastHeading = forward.heading();
    }
    const right = p5.Vector.fromAngle(forward.heading() + HALF_PI);
    const steeringRange = vehicle.vel.magSq() / Math.max(vehicle.maxForce, 1e-4) * 2;
    const lookDistance = Math.max(Math.max(0, detectionRadius), steeringRange);
    const ahead = forward.copy().setMag(lookDistance);
    vehicle.debugAhead = p5.Vector.add(vehicle.pos, ahead);
    vehicle.debugAheadMid = p5.Vector.add(vehicle.pos, ahead.copy().mult(0.5));

    let commitment = null;
    for (const [obstacle, state] of avoidanceSides) {
        if (!obstacles.includes(obstacle) || !state.waypoint) {
            avoidanceSides.delete(obstacle);
            continue;
        }
        if (vehicle.pos.dist(state.waypoint) <= Math.max(8, vehicle.r * 0.4)) {
            avoidanceSides.delete(obstacle);
            continue;
        }
        if (!commitment) {
            commitment = { obstacle, state };
        }
    }

    let threat = commitment ? commitment.obstacle : null;
    let threatSide = commitment ? commitment.state.side : 0;
    let threatUrgency = commitment ? 1 : 0;

    let nextThreat = null;
    let nextThreatSide = 0;
    let nextThreatDistance = Infinity;
    let nextThreatUrgency = 0;
    for (const obstacle of obstacles) {
        if (commitment && obstacle === commitment.obstacle) {
            continue;
        }
        const offset = p5.Vector.sub(obstacle.pos, vehicle.pos);
        const along = offset.dot(forward);
        const lateral = Math.abs(offset.dot(right));
        const clearance = vehicle.r + obstacle.r;
        if (along < -clearance
            || along > lookDistance + clearance
            || lateral > clearance + 12) {
            continue;
        }

        const collisionDistance = along - Math.sqrt(
            Math.max(0, clearance * clearance - Math.min(lateral, clearance) ** 2)
        );
        if (collisionDistance >= nextThreatDistance) {
            continue;
        }

        const lateralOffset = offset.dot(right);
        nextThreat = obstacle;
        nextThreatDistance = collisionDistance;
        nextThreatSide = Math.abs(lateralOffset) > 1
            ? (lateralOffset > 0 ? -1 : 1)
            : (Math.sin(obstacle.pos.x * 12.9898 + obstacle.pos.y * 78.233) < 0 ? -1 : 1);
        nextThreatUrgency = constrain(
            1 - Math.max(0, collisionDistance) / Math.max(1, lookDistance),
            0.35,
            1
        );
    }

    if (nextThreat
        && (!commitment
            || nextThreatDistance < vehicle.pos.dist(commitment.state.waypoint))) {
        if (commitment) {
            avoidanceSides.delete(commitment.obstacle);
        }
        commitment = null;
        threat = nextThreat;
        threatSide = nextThreatSide;
        threatUrgency = nextThreatUrgency;
    }

    vehicle.debugThreat = threat;
    if (!threat) {
        vehicle.lastAvoidForce.set(0, 0);
        return vehicle.lastAvoidForce.copy();
    }

    if (!commitment) {
        const clearance = vehicle.r + threat.r;
        const waypointForward = forward.copy().setMag(clearance + vehicle.r + 12);
        const sideDistance = clearance + vehicle.r * 4;
        const makeWaypoint = side => p5.Vector.add(
            p5.Vector.add(threat.pos, waypointForward),
            right.copy().setMag(side * sideDistance)
        );
        const isInsideArena = point =>
            point.x >= vehicle.r + 4
            && point.x <= width - vehicle.r - 4
            && point.y >= vehicle.r + 4
            && point.y <= height - vehicle.r - 4;
        let waypoint = makeWaypoint(threatSide);
        if (!isInsideArena(waypoint)) {
            const alternative = makeWaypoint(-threatSide);
            if (isInsideArena(alternative)) {
                threatSide *= -1;
                waypoint = alternative;
            } else {
                waypoint.x = constrain(waypoint.x, vehicle.r + 4, width - vehicle.r - 4);
                waypoint.y = constrain(waypoint.y, vehicle.r + 4, height - vehicle.r - 4);
            }
        }
        commitment = {
            obstacle: threat,
            state: {
                side: threatSide,
                waypoint
            }
        };
        avoidanceSides.set(threat, commitment.state);
    }

    const desired = p5.Vector.sub(commitment.state.waypoint, vehicle.pos);
    const distance = desired.mag();
    if (distance > 1e-6) {
        const brakingSpeed = Math.sqrt(2 * vehicle.maxForce * distance);
        desired.setMag(Math.min(vehicle.maxSpeed, brakingSpeed));
    }
    const steering = p5.Vector.sub(desired, vehicle.vel);
    steering.limit(vehicle.maxForce * threatUrgency);
    vehicle.lastAvoidForce.set(steering);
    return vehicle.lastAvoidForce.copy();
}

function combineSteeringWithObstaclePriority(vehicle, avoidanceForce, behaviorForces) {
    if (avoidanceForce.magSq() < 1e-8) {
        return behaviorForces
            .reduce((combined, force) => combined.add(force), createVector(0, 0))
            .limit(vehicle.maxForce);
    }

    const avoidanceDirection = avoidanceForce.copy().normalize();
    const combined = avoidanceForce.copy().mult(3);
    for (const force of behaviorForces) {
        const contribution = force.copy();
        const opposingComponent = contribution.dot(avoidanceDirection);
        if (opposingComponent < 0) {
            contribution.sub(avoidanceDirection.copy().mult(opposingComponent));
        }
        combined.add(contribution);
    }
    return combined.limit(vehicle.maxForce);
}
