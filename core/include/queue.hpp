#ifndef QUEUE_HPP
#define QUEUE_HPP

#include <string>
#include <amqp.h> 
#include "deployEvent.hpp"

class Queue
{
private:
    std::string queueName;

    DeployEvent parseMessage(const std::string& message);

    // Sends the outcome of a deployment to the backend ("deployment.results").
    void publishResult(
        amqp_connection_state_t connection,
        const DeployEvent& event,
        bool success,
        const std::string& stage = "",
        const std::string& error = ""
    );


public:
    explicit Queue(const std::string& queueName);

    void consume();
};

#endif


// The .hpp file is the interface/declaration of the class.

// It tells the compiler:

// "There is a class called Queue. It contains this data and these functions."

// It does not tell the compiler how consume() works yet.
//---------------------------------------------------------------
//implicit vs explicit
// Implicit = automatic :Something happens without you directly asking for it.
// Explicit = you clearly ask for it :You write exactly what you want.

//expl: 
// int x = 10;
// double y = x;C++ automatically converts:int 10 -> double 10.0
//double y = static_cast<double>(x); I explicitly want you to convert x to a double."

//----------------------------------------------------------------
//for constructors
// class Queue
// {
// public:
//     Queue(std::int a)
//     {
//         cout<< "a is"<<a
//     }
// };
// we can Queue q(9); or Queue q = 9.8 -> a is 9.8 or Queue q= 'Z' !!!!BUG -> tetada a is 90
//Queue q = 9 hedhi tkhdm kenchi fi cas constructor ykbl one param or one param and the others are default
//with explicit we can  avoid that bug  Queue q = 9.8 or Queue q= 'Z' maaach ytaaaadou