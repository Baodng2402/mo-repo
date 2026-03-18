import { View, Text } from 'react-native'
import React from 'react'

const Waiting = () => {
    return (
        <View style={{ flex: 1, backgroundColor: '#101922', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'white' }}>Loading Assets...</Text>
        </View>
    )
}

export default Waiting