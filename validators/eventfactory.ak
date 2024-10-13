module CertificateNFTFactory

use aiken/transaction
use aiken/builtins
use aiken/token

type Event = {
    event_id: Integer,
    event_name: String,
    event_date: String,
    event_description: String,
    event_url: String,
    max_certificates: Integer,
    certificates_issued: Integer,
    organizer: Address
}

type CertificateNFT = {
    token_name: String,
    metadata: String,
    event_id: Integer,
    recipient: Address
}

// Contract state: stores events and issued certificates
type State = {
    events: Map<Integer, Event>,
    certificates: Map<Integer, CertificateNFT>,
    certificate_count: Integer
}

// Function to create a new event by the organizer
pub fn create_event(
    state: State,
    event_name: String,
    event_date: String,
    event_description: String,
    event_url: String, 
    max_certificates: Integer,
    organizer: Address
) -> State {
    let new_event_id = state.events.len() + 1
    let new_event = {
        event_id: new_event_id,
        event_name: event_name,
        event_date: event_date,
        event_description: event_description,
        event_url: event_url,
        max_certificates: max_certificates,
        certificates_issued: 0,
        organizer: organizer
    }
    state.events.insert(new_event_id, new_event)
    state
}

// Function to mint certificates (NFTs) for participants
pub fn mint_certificate(
    state: State,
    event_id: Integer,
    token_name: String,
    metadata: String,
    recipient: Address
) -> Result<State, String> {
    let event = state.events.get(event_id)
    case event {
        Some(e) => {
            if e.certificates_issued >= e.max_certificates {
                Err("Maximum certificates issued")
            } else {
                let new_certificate_id = state.certificate_count + 1
                let new_certificate = {
                    token_name: token_name,
                    metadata: metadata,  
                    event_id: event_id,
                    recipient: recipient
                }

                let updated_event = e {
                    certificates_issued: e.certificates_issued + 1
                }
                let new_state = state {
                    certificate_count: state.certificate_count + 1,
                    events: state.events.insert(event_id, updated_event),
                    certificates: state.certificates.insert(new_certificate_id, new_certificate)
                }
                Ok(new_state)
            }
        }
        None => Err("Event not found")
    }
}

// Function to get event details by event ID
pub fn get_event_details(state: State, event_id: Integer) -> Option<Event> {
    state.events.get(event_id)
}

// Function to get certificate details by certificate ID
pub fn get_certificate_details(state: State, certificate_id: Integer) -> Option<CertificateNFT> {
    state.certificates.get(certificate_id)
}